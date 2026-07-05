import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createMilestone, deleteMilestone, listTasks, updateMilestone, updateTask } from "../api/client";
import { useMilestones, useInvalidateAll, useMarkTaskDone, useSetTaskStatus } from "../hooks/queries";
import { useTaskDrawer } from "../state/taskDrawer";
import { ProgressBar } from "../components/ProgressBar";
import { Checkbox } from "../components/ui/checkbox";
import { formatDuration } from "../components/DurationInput";
import type { Milestone, Task } from "../api/types";

// Reassign sequential sort_order to a reordered list, then persist only the rows
// whose position actually changed. Shared by both sortable lists below.
async function persistOrder<T extends { id: number; sort_order: number }>(
  reordered: T[],
  patch: (id: number, sortOrder: number) => Promise<unknown>
): Promise<void> {
  await Promise.all(
    reordered.map((item, index) =>
      item.sort_order === index ? null : patch(item.id, index)
    )
  );
}

// Shared drag handle — the only element that starts a drag, so surrounding
// controls (checkbox, edit/delete, row click) keep working.
// Listeners come from useSortable; typed loosely to avoid depending on a
// deep dnd-kit internal export path.
type DragListeners = ReturnType<typeof useSortable>["listeners"];

function DragHandle({
  attributes,
  listeners,
  label,
}: {
  attributes: DraggableAttributes;
  listeners: DragListeners;
  label: string;
}) {
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={15} />
    </button>
  );
}

// "7 days left" / "Due today" / "3 days overdue" countdown to a milestone's target date.
function dDayLabel(targetDate: string | null): string | null {
  if (!targetDate) return null;
  const days = differenceInCalendarDays(new Date(targetDate.slice(0, 10)), new Date());
  if (days === 0) return "Due today";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} left`;
  const overdue = Math.abs(days);
  return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
}

function MilestoneTaskRow({ task }: { task: Task }) {
  const status = useSetTaskStatus();
  const markDone = useMarkTaskDone();
  const { openTaskDrawer } = useTaskDrawer();
  const done = task.status === "done";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={done ? "milestone-task-row done" : "milestone-task-row"}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      role="button"
      tabIndex={0}
      onClick={() => openTaskDrawer({ taskId: task.id })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTaskDrawer({ taskId: task.id });
        }
      }}
    >
      <DragHandle attributes={attributes} listeners={listeners} label={`Reorder ${task.title}`} />
      <span onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={done}
          disabled={status.isPending}
          onCheckedChange={(checked) =>
            checked ? markDone(task) : status.mutate({ id: task.id, status: "todo" })
          }
          aria-label={`Mark ${task.title} done`}
        />
      </span>
      <span className="milestone-task-title">{task.title}</span>
      <button
        type="button"
        className="milestone-task-remove"
        aria-label={`Archive ${task.title}`}
        onClick={(e) => {
          e.stopPropagation();
          status.mutate({ id: task.id, status: "archived" });
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

function MilestoneRow({ m }: { m: Milestone }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(m.title);
  const [editDate, setEditDate] = useState(m.target_date ? m.target_date.slice(0, 10) : "");
  const { openTaskDrawer } = useTaskDrawer();
  const invalidate = useInvalidateAll();
  const { data: tasks } = useQuery({
    queryKey: ["milestone_tasks", m.id],
    queryFn: () => listTasks({ milestone: m.id }),
    enabled: open,
  });
  const label = m.total_tasks != null ? `${m.done_tasks}/${m.total_tasks}` : "no tasks";
  const dDay = dDayLabel(m.target_date);

  // Optimistic task order — resync from server data whenever the id set changes,
  // so a drop reorders instantly before the sort_order PATCHes land.
  const serverTasks = (tasks ?? []).filter((t) => t.status !== "archived");
  const [orderedTasks, setOrderedTasks] = useState<Task[]>(serverTasks);
  const serverTaskIds = serverTasks.map((t) => t.id).join(",");
  useEffect(() => {
    setOrderedTasks(serverTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTaskIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const reorderTasks = useMutation({
    mutationFn: (reordered: Task[]) =>
      persistOrder(reordered, (id, sort_order) => updateTask(id, { sort_order })),
    onSuccess: () => invalidate(),
  });

  function onTaskDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedTasks.findIndex((t) => t.id === active.id);
    const newIndex = orderedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(orderedTasks, oldIndex, newIndex);
    setOrderedTasks(next);
    reorderTasks.mutate(next);
  }

  const save = useMutation({
    mutationFn: () =>
      updateMilestone(m.id, {
        title: editTitle.trim(),
        target_date: editDate || null,
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteMilestone(m.id),
    onSuccess: () => invalidate(),
  });

  const startEdit = () => {
    setEditTitle(m.title);
    setEditDate(m.target_date ? m.target_date.slice(0, 10) : "");
    setEditing(true);
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.id });

  return (
    <article
      ref={setNodeRef}
      className="milestone-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      {editing ? (
        <form
          className="milestone-edit-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (editTitle.trim()) save.mutate();
          }}
        >
          <input
            className="milestone-edit-title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            aria-label="Milestone name"
            autoFocus
          />
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            aria-label="Milestone deadline"
          />
          <button className="btn primary" type="submit" disabled={!editTitle.trim() || save.isPending}>
            Save
          </button>
          <button className="btn" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="milestone-head">
          <button
            className="milestone-expand"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse milestone" : "Expand milestone"}
          >
            {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>
          <button
            className="milestone-title"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen((o) => !o)}
          >
            <strong>{m.title}</strong>
            {dDay && <span className="milestone-dday">{dDay}</span>}
          </button>
          <div className="milestone-progress">
            <ProgressBar fraction={m.progress} label={label} />
            {m.total_minutes > 0 && (
              <span className="milestone-time">{formatDuration(m.total_minutes)}</span>
            )}
          </div>
          <div className="milestone-card-actions">
            <button
              type="button"
              className="milestone-card-action"
              aria-label={`Edit ${m.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={startEdit}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="milestone-card-action danger"
              aria-label={`Delete ${m.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
      {open && !editing && (
        <div className="milestone-body" onPointerDown={(e) => e.stopPropagation()}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onTaskDragEnd}
          >
            <SortableContext
              items={orderedTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedTasks.map((t) => (
                <MilestoneTaskRow key={t.id} task={t} />
              ))}
            </SortableContext>
          </DndContext>
          <button
            type="button"
            className="milestone-add-task"
            onClick={() => openTaskDrawer({ milestone: m.id })}
          >
            <Plus size={13} />
            add task
          </button>
        </div>
      )}
    </article>
  );
}

export function MilestonesView() {
  const { data: milestones, isLoading } = useMilestones();
  const invalidate = useInvalidateAll();
  const [newTitle, setNewTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  // Optimistic milestone order — resync from server whenever the id set changes.
  const [ordered, setOrdered] = useState<Milestone[]>(milestones ?? []);
  const serverIds = (milestones ?? []).map((m) => m.id).join(",");
  useEffect(() => {
    setOrdered(milestones ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const reorder = useMutation({
    mutationFn: (reordered: Milestone[]) =>
      persistOrder(reordered, (id, sort_order) => updateMilestone(id, { sort_order })),
    onSuccess: () => invalidate(),
  });

  function onMilestoneDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((m) => m.id === active.id);
    const newIndex = ordered.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    reorder.mutate(next);
  }

  const create = useMutation({
    mutationFn: () =>
      createMilestone({
        title: newTitle.trim(),
        target_date: targetDate || undefined,
      }),
    onSuccess: () => {
      setNewTitle("");
      setTargetDate("");
      invalidate();
    },
  });

  if (isLoading) return <p className="muted">Loading milestones…</p>;

  return (
    <div className="view-stack">
      <div className="view-heading">
        <p className="eyebrow">Progress system</p>
        <h2 className="view-title">Milestone Progress</h2>
      </div>
      <form
        className="create-strip"
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim()) create.mutate();
        }}
      >
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New milestone title" />
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        <button className="btn primary icon-label" type="submit" disabled={!newTitle.trim()}>
          <Plus size={15} />
          Milestone
        </button>
      </form>
      {ordered.length === 0 ? (
        <p className="empty">No milestones.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onMilestoneDragEnd}
        >
          <SortableContext
            items={ordered.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="milestone-grid">
              {ordered.map((m) => (
                <MilestoneRow key={m.id} m={m} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
