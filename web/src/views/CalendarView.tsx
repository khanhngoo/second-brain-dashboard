import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  type DateClickArg,
  type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Check,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  createTimeBlock,
  deleteTimeBlock,
  getCalendarStatus,
  getPillars,
  getTask,
  listExternalEvents,
  listTimeBlocks,
  listTasks,
  moveTimeBlock,
  setTaskStatus,
  syncCalendar,
} from "../api/client";
import { keys, useInvalidateAll } from "../hooks/queries";
import { useTaskDrawer } from "../state/taskDrawer";
import { useBlockDrawer } from "../state/blockDrawer";
import { usePillarFilter } from "../state/pillarFilter";
import type { Task } from "../api/types";

const FALLBACK_DURATION_MIN = 60;
const NEUTRAL_BLOCK_COLOR = "#8e8b82";

type PopoverPoint = { x: number; y: number };
type PendingSelection = PopoverPoint & {
  start_at: string;
  end_at: string;
  label: string;
};
type DetailPopover = PopoverPoint & {
  kind: "block" | "external";
  title: string;
  start_at: string;
  end_at: string;
  blockId?: number;
  taskId?: number;
  provider?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalIso(date: Date) {
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":00",
  ].join("");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatDateTimeLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const startTime = s.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = e.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}, ${startTime} - ${endTime}`;
}

function normalizeTimedRange(start: Date, end: Date | null, durationMin: number, allDay: boolean) {
  const normalizedStart = new Date(start);
  if (allDay) {
    normalizedStart.setHours(9, 0, 0, 0);
  }
  const normalizedEnd = end && !allDay ? end : addMinutes(normalizedStart, durationMin);
  return {
    start_at: toLocalIso(normalizedStart),
    end_at: toLocalIso(normalizedEnd),
  };
}

function initialVisibleRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start: toLocalIso(start), end: toLocalIso(end) };
}

function formatRangeLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  e.setDate(e.getDate() - 1);
  return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function popoverPoint(jsEvent?: MouseEvent | null): PopoverPoint {
  const fallback = { x: 520, y: 220 };
  if (!jsEvent || typeof window === "undefined") return fallback;
  return {
    x: Math.min(jsEvent.clientX + 12, window.innerWidth - 340),
    y: Math.min(jsEvent.clientY + 12, window.innerHeight - 260),
  };
}

function blendWithCanvas(hex: string, opacity: number) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const n = Number.parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function CalendarView() {
  const [range, setRange] = useState(initialVisibleRange);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [detailPopover, setDetailPopover] = useState<DetailPopover | null>(null);
  const invalidate = useInvalidateAll();
  const { openTaskDrawer } = useTaskDrawer();
  const { openBlockDrawer } = useBlockDrawer();
  const { apiPillar } = usePillarFilter();

  const { data: blocks } = useQuery({
    queryKey: keys.timeBlocks(range.start, range.end),
    queryFn: () => listTimeBlocks(range.start, range.end),
  });
  const { data: events } = useQuery({
    queryKey: keys.externalEvents(range.start, range.end),
    queryFn: () => listExternalEvents(range.start, range.end),
  });
  const { data: openTasks } = useQuery({
    queryKey: ["tasks", "schedulable", apiPillar ?? "all"],
    queryFn: () => listTasks({ status: "todo", pillar: apiPillar }),
  });
  const { data: allTasks } = useQuery({
    queryKey: ["tasks", "calendar-metadata"],
    queryFn: () => listTasks({}),
  });
  const { data: pillars } = useQuery({
    queryKey: keys.pillars(),
    queryFn: getPillars,
  });
  const { data: selectedTaskDetail } = useQuery({
    queryKey: detailPopover?.taskId ? keys.task(detailPopover.taskId) : ["task", "calendar-popover", "none"],
    queryFn: () => getTask(detailPopover!.taskId!),
    enabled: detailPopover?.kind === "block" && detailPopover.taskId != null,
  });

  const { data: calStatus } = useQuery({
    queryKey: keys.calendarStatus(),
    queryFn: getCalendarStatus,
  });
  const sync = useMutation({ mutationFn: syncCalendar, onSuccess: invalidate });

  const create = useMutation({
    mutationFn: ({ taskId, start_at, end_at }: { taskId: number; start_at: string; end_at: string }) =>
      createTimeBlock(taskId, start_at, end_at),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteTimeBlock(id), onSuccess: invalidate });
  const move = useMutation({
    mutationFn: ({ id, start_at, end_at }: { id: number; start_at: string; end_at: string }) =>
      moveTimeBlock(id, start_at, end_at),
    onSuccess: invalidate,
  });
  const markDone = useMutation({
    mutationFn: (id: number) => setTaskStatus(id, "done"),
    onSuccess: invalidate,
  });

  const taskById = useMemo(() => {
    const map = new Map<number, Task>();
    for (const task of allTasks ?? []) map.set(task.id, task);
    for (const task of openTasks ?? []) map.set(task.id, task);
    return map;
  }, [allTasks, openTasks]);

  const blockById = useMemo(() => {
    return new Map((blocks ?? []).map((block) => [block.id, block]));
  }, [blocks]);

  const pillarById = useMemo(() => {
    return new Map((pillars ?? []).map((pillar) => [pillar.id, pillar]));
  }, [pillars]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    const localBlocks = (blocks ?? []).map((block): EventInput => {
      const task = taskById.get(block.task_id);
      const color = pillarById.get(task?.pillar_id ?? -1)?.color ?? NEUTRAL_BLOCK_COLOR;
      const isDone = task?.status === "done";
      return {
        id: `block-${block.id}`,
        title: task?.title ?? `Task #${block.task_id}`,
        start: block.start_at,
        end: block.end_at,
        editable: true,
        backgroundColor: blendWithCanvas(color, isDone ? 0.12 : 0.2),
        borderColor: blendWithCanvas(color, isDone ? 0.28 : 0.72),
        textColor: "var(--ink)",
        classNames: [
          "fc-local-block",
          `fc-block-${block.status}`,
          isDone ? "fc-task-done" : "",
        ].filter(Boolean),
        extendedProps: {
          blockId: block.id,
          kind: "block",
          status: block.status,
          taskId: block.task_id,
          taskStatus: task?.status,
          pillarColor: color,
        },
      };
    });

    const externalEvents = (events ?? []).map((event): EventInput => ({
      id: `external-${event.id}`,
      title: event.title ?? "(external)",
      start: event.start_at,
      end: event.end_at,
      editable: false,
      classNames: ["fc-external-event"],
      extendedProps: {
        kind: "external",
        provider: event.provider,
      },
    }));

    return [...externalEvents, ...localBlocks];
  }, [blocks, events, pillarById, taskById]);

  function handleDatesSet(arg: DatesSetArg) {
    setRange({ start: toLocalIso(arg.start), end: toLocalIso(arg.end) });
  }

  function openTaskPicker(start: Date, end: Date | null, allDay: boolean, point: PopoverPoint) {
    const range = normalizeTimedRange(start, end, FALLBACK_DURATION_MIN, allDay);
    setDetailPopover(null);
    setPendingSelection({
      ...point,
      ...range,
      label: formatDateTimeLabel(range.start_at, range.end_at),
    });
  }

  function handleDateClick(arg: DateClickArg) {
    openTaskPicker(arg.date, null, arg.allDay, popoverPoint(arg.jsEvent));
  }

  function handleSelect(arg: DateSelectArg) {
    openTaskPicker(arg.start, arg.end, arg.allDay, popoverPoint(arg.jsEvent));
  }

  function handleEventClick(arg: EventClickArg) {
    const { event } = arg;
    const start = event.start ? toLocalIso(event.start) : "";
    const end = event.end ? toLocalIso(event.end) : start;
    setPendingSelection(null);
    setDetailPopover({
      ...popoverPoint(arg.jsEvent),
      kind: event.extendedProps.kind === "block" ? "block" : "external",
      title: event.title,
      start_at: start,
      end_at: end,
      blockId: event.extendedProps.blockId,
      taskId: event.extendedProps.taskId,
      provider: event.extendedProps.provider,
    });
  }

  async function createSelectedBlock(taskId: number) {
    if (!pendingSelection) return;
    await create.mutateAsync({
      taskId,
      start_at: pendingSelection.start_at,
      end_at: pendingSelection.end_at,
    });
    setPendingSelection(null);
  }

  function openSelectedTaskDrawer() {
    if (!detailPopover?.taskId) return;
    openTaskDrawer({ taskId: detailPopover.taskId });
    setDetailPopover(null);
  }

  function openBlockEditor(blockId: number, title?: string) {
    const block = blockById.get(blockId);
    if (!block) return;
    openBlockDrawer({ block, title });
    setDetailPopover(null);
    setPendingSelection(null);
  }

  async function markTaskDone(taskId: number) {
    await markDone.mutateAsync(taskId);
    setDetailPopover(null);
  }

  async function deleteBlock(blockId: number) {
    await remove.mutateAsync(blockId);
    setDetailPopover(null);
  }

  async function handleEventDrop(arg: EventDropArg) {
    const blockId = Number(arg.event.extendedProps.blockId);
    if (!blockId || !arg.event.start) {
      arg.revert();
      return;
    }
    const { start_at, end_at } = normalizeTimedRange(
      arg.event.start,
      arg.event.end,
      FALLBACK_DURATION_MIN,
      arg.event.allDay,
    );
    try {
      await move.mutateAsync({ id: blockId, start_at, end_at });
    } catch {
      arg.revert();
    }
  }

  async function handleEventResize(arg: EventResizeDoneArg) {
    const blockId = Number(arg.event.extendedProps.blockId);
    if (!blockId || !arg.event.start) {
      arg.revert();
      return;
    }
    const { start_at, end_at } = normalizeTimedRange(
      arg.event.start,
      arg.event.end,
      FALLBACK_DURATION_MIN,
      arg.event.allDay,
    );
    try {
      await move.mutateAsync({ id: blockId, start_at, end_at });
    } catch {
      arg.revert();
    }
  }

  function renderEventContent(arg: EventContentArg) {
    const blockId = arg.event.extendedProps.blockId as number | undefined;
    const taskId = arg.event.extendedProps.taskId as number | undefined;
    const taskStatus = arg.event.extendedProps.taskStatus as string | undefined;
    const isLocalBlock = arg.event.extendedProps.kind === "block" && blockId != null;

    return (
      <div className="fc-event-inner">
        <div className="fc-event-main-text">
          <span className="fc-event-time-text">{arg.timeText}</span>
          <span className="fc-event-title-text">{arg.event.title}</span>
        </div>
        {isLocalBlock && (
          <div className="fc-event-actions">
            {taskId != null && taskStatus !== "done" && (
              <button
                className="mini-icon fc-done-event"
                type="button"
                aria-label={`Mark ${arg.event.title} done`}
                onClick={(e) => {
                  e.stopPropagation();
                  markTaskDone(taskId);
                }}
              >
                <Check size={12} />
              </button>
            )}
            <button
              className="mini-icon fc-edit-event"
              type="button"
              aria-label={`Edit ${arg.event.title}`}
              onClick={(e) => {
                e.stopPropagation();
                openBlockEditor(blockId, arg.event.title);
              }}
            >
              <Pencil size={12} />
            </button>
            <button
              className="mini-icon fc-delete-event"
              type="button"
              aria-label={`Delete ${arg.event.title}`}
              onClick={(e) => {
                e.stopPropagation();
                deleteBlock(blockId);
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="view-stack">
      <div className="view-heading split">
        <div>
          <p className="eyebrow">Schedule work</p>
          <h2 className="view-title">Calendar</h2>
        </div>
        <span className="date-chip"><CalendarClock size={16} /> {formatRangeLabel(range.start, range.end)}</span>
      </div>
      <div className="calendar-status">
        <span className="muted">
          {calStatus?.enabled
            ? `Calendar connected: ${calStatus.accounts.map((a) => a.account_email).join(", ")}`
            : "No calendar connected (run `sb calendar connect`). Blocks stay local."}
        </span>
        <button className="btn secondary icon-label" disabled={!calStatus?.enabled} onClick={() => sync.mutate()}>
          <RefreshCw size={15} />
          {sync.isPending ? "Syncing..." : "Sync now"}
        </button>
      </div>
      <div className="cal-layout">
        <div className="full-calendar-shell">
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
            }}
            buttonText={{ today: "Today", day: "Day", week: "Week", month: "Month", list: "List" }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            nowIndicator
            editable
            selectable
            selectMirror
            eventResizableFromStart
            eventDurationEditable
            events={calendarEvents}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventContent={renderEventContent}
            height="auto"
          />
          {pendingSelection && (
            <div className="calendar-popover task-picker-popover" style={{ left: pendingSelection.x, top: pendingSelection.y }}>
              <div className="popover-head">
                <div>
                  <p className="eyebrow">Schedule</p>
                  <h3>{pendingSelection.label}</h3>
                </div>
                <button className="mini-icon" type="button" aria-label="Close task picker" onClick={() => setPendingSelection(null)}>
                  <X size={13} />
                </button>
              </div>
              <div className="task-picker-list">
                {(openTasks ?? []).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="task-picker-row"
                    onClick={() => createSelectedBlock(task.id)}
                    disabled={create.isPending}
                  >
                    <span
                      className="dot"
                      style={{ background: pillarById.get(task.pillar_id)?.color ?? NEUTRAL_BLOCK_COLOR }}
                    />
                    <span>{task.title}</span>
                    <span className="muted">{FALLBACK_DURATION_MIN}m</span>
                  </button>
                ))}
                {(openTasks ?? []).length === 0 && <p className="empty">No todo tasks in this filter.</p>}
              </div>
            </div>
          )}
          {detailPopover && (
            <div className="calendar-popover detail-popover" style={{ left: detailPopover.x, top: detailPopover.y }}>
              <div className="popover-head">
                <div>
                  <p className="eyebrow">{detailPopover.kind === "block" ? "Task block" : detailPopover.provider ?? "External"}</p>
                  <h3>{detailPopover.title}</h3>
                </div>
                <button className="mini-icon" type="button" aria-label="Close event details" onClick={() => setDetailPopover(null)}>
                  <X size={13} />
                </button>
              </div>
              <p className="popover-time">{formatDateTimeLabel(detailPopover.start_at, detailPopover.end_at)}</p>
              {detailPopover.kind === "block" ? (
                <>
                  <div className="detail-grid">
                    <span>Status</span>
                    <strong>{selectedTaskDetail?.status ?? "loading"}</strong>
                    {selectedTaskDetail?.due_date && (
                      <>
                        <span>Due</span>
                        <strong>{selectedTaskDetail.due_date}</strong>
                      </>
                    )}
                    {selectedTaskDetail && (
                      <>
                        <span>Subtasks</span>
                        <strong>{selectedTaskDetail.subtasks.filter((s) => s.done).length}/{selectedTaskDetail.subtasks.length}</strong>
                      </>
                    )}
                  </div>
                  {selectedTaskDetail?.description && <p className="popover-description">{selectedTaskDetail.description}</p>}
                  <div className="popover-actions">
                    {detailPopover.blockId != null && (
                      <button
                        className="btn secondary icon-label"
                        type="button"
                        onClick={() => openBlockEditor(detailPopover.blockId!, detailPopover.title)}
                      >
                        <Pencil size={14} />
                        Edit block
                      </button>
                    )}
                    <button className="btn secondary" type="button" onClick={openSelectedTaskDrawer}>
                      Open task
                    </button>
                    {detailPopover.taskId != null && selectedTaskDetail?.status !== "done" && (
                      <button className="btn primary icon-label" type="button" onClick={() => markTaskDone(detailPopover.taskId!)}>
                        <Check size={14} />
                        Done
                      </button>
                    )}
                    {detailPopover.blockId != null && (
                      <button className="btn secondary icon-label" type="button" onClick={() => deleteBlock(detailPopover.blockId!)}>
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="muted">Readonly calendar event.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
