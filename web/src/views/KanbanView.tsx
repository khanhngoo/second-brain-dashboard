import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useKanban, useSetTaskStatus } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { TaskCard } from "../components/TaskCard";
import type { Kanban, Task, TaskStatus } from "../api/types";

type ColumnKey = keyof Kanban; // "todo" | "doing" | "done"

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { status: task.status },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <TaskCard task={task} />
    </div>
  );
}

function Column({
  status,
  label,
  tasks,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={isOver ? "column over" : "column"}>
      <h3>
        {label} <span className="muted">({tasks.length})</span>
      </h3>
      {tasks.map((t) => (
        <DraggableCard key={t.id} task={t} />
      ))}
    </div>
  );
}

export function KanbanView() {
  const { apiPillar } = usePillarFilter();
  const { data: kanban, isLoading } = useKanban(apiPillar);
  const setStatus = useSetTaskStatus();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragStart(e: DragStartEvent) {
    const id = Number(e.active.id);
    const all = kanban ? [...kanban.todo, ...kanban.doing, ...kanban.done] : [];
    setActive(all.find((t) => t.id === id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const id = Number(e.active.id);
    const newStatus = String(e.over.id) as TaskStatus;
    const fromStatus = e.active.data.current?.status as TaskStatus | undefined;
    if (fromStatus === newStatus) return;
    setStatus.mutate({ id, status: newStatus });
  }

  if (isLoading || !kanban) return <p className="muted">Loading board…</p>;

  return (
    <div>
      <h2 className="view-title">Kanban</h2>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="board">
          {COLUMNS.map((c) => (
            <Column key={c.key} status={c.key} label={c.label} tasks={kanban[c.key]} />
          ))}
        </div>
        <DragOverlay>{active ? <TaskCard task={active} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
