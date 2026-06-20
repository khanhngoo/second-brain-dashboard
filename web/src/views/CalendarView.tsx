import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createTimeBlock,
  deleteTimeBlock,
  getCalendarStatus,
  listExternalEvents,
  listTimeBlocks,
  listTasks,
  syncCalendar,
} from "../api/client";
import { keys, useInvalidateAll } from "../hooks/queries";
import { Timer } from "../components/Timer";
import type { Task } from "../api/types";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 – 20:00

function dayBounds(date: string) {
  return { start: `${date}T00:00:00`, end: `${date}T23:59:59` };
}

function SidePanelTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { taskId: task.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="task-card"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="task-title">{task.title}</div>
      <Timer task={task} />
    </div>
  );
}

function HourSlot({ hour, children }: { hour: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour-${hour}`, data: { hour } });
  return (
    <div className="cal-hour">
      <div className="cal-hour-label">{String(hour).padStart(2, "0")}:00</div>
      <div ref={setNodeRef} className="cal-slot" style={isOver ? { background: "rgba(108,140,255,0.15)" } : undefined}>
        {children}
      </div>
    </div>
  );
}

export function CalendarView() {
  const [date] = useState(() => new Date().toISOString().slice(0, 10));
  const { start, end } = dayBounds(date);
  const invalidate = useInvalidateAll();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: blocks } = useQuery({
    queryKey: keys.timeBlocks(start, end),
    queryFn: () => listTimeBlocks(start, end),
  });
  const { data: events } = useQuery({
    queryKey: keys.externalEvents(start, end),
    queryFn: () => listExternalEvents(start, end),
  });
  const { data: openTasks } = useQuery({
    queryKey: ["tasks", "schedulable"],
    queryFn: () => listTasks({ status: "todo" }),
  });

  const { data: calStatus } = useQuery({
    queryKey: keys.calendarStatus(),
    queryFn: getCalendarStatus,
  });
  const sync = useMutation({ mutationFn: syncCalendar, onSuccess: invalidate });

  const create = useMutation({
    mutationFn: ({ taskId, hour }: { taskId: number; hour: number }) => {
      const s = `${date}T${String(hour).padStart(2, "0")}:00:00`;
      const e = `${date}T${String(hour + 1).padStart(2, "0")}:00:00`;
      return createTimeBlock(taskId, s, e);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => deleteTimeBlock(id), onSuccess: invalidate });

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const taskId = e.active.data.current?.taskId as number | undefined;
    const hour = e.over.data.current?.hour as number | undefined;
    if (taskId != null && hour != null) create.mutate({ taskId, hour });
  }

  function hourOf(iso: string) {
    return new Date(iso).getHours();
  }

  return (
    <div>
      <h2 className="view-title">Calendar — {date}</h2>
      <div className="block-row" style={{ marginBottom: "0.75rem" }}>
        <span className="muted">
          {calStatus?.enabled
            ? `Calendar connected: ${calStatus.accounts.map((a) => a.account_email).join(", ")}`
            : "No calendar connected (run `sb calendar connect`). Blocks stay local."}
        </span>
        <button className="btn" disabled={!calStatus?.enabled} onClick={() => sync.mutate()}>
          {sync.isPending ? "Syncing…" : "Sync now"}
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="cal-layout">
          <aside>
            <h3 className="muted">To schedule (drag →)</h3>
            {(openTasks ?? []).map((t) => (
              <SidePanelTask key={t.id} task={t} />
            ))}
            {(openTasks ?? []).length === 0 && <p className="empty">No open tasks.</p>}
          </aside>

          <div className="cal-grid">
            {HOURS.map((h) => (
              <HourSlot key={h} hour={h}>
                {(events ?? [])
                  .filter((ev) => hourOf(ev.start_at) === h)
                  .map((ev) => (
                    <div key={`e-${ev.id}`} className="cal-event external" style={{ top: 2 }}>
                      {ev.title ?? "(external)"}
                    </div>
                  ))}
                {(blocks ?? [])
                  .filter((b) => hourOf(b.start_at) === h)
                  .map((b) => (
                    <div
                      key={`b-${b.id}`}
                      className="cal-event owned"
                      style={{ top: 2 }}
                      onClick={() => remove.mutate(b.id)}
                      title="Click to remove"
                    >
                      Block #{b.id} · {b.status}
                    </div>
                  ))}
              </HourSlot>
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
