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
import { useMutation } from "@tanstack/react-query";
import { updateTask } from "../api/client";
import { useEisenhower, useInvalidateAll } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { TaskCard } from "../components/TaskCard";
import type { Quadrant, Task } from "../api/types";

const QUADRANTS: { key: Quadrant; label: string; flags: { is_urgent: number; is_important: number } }[] = [
  { key: "urgent_important", label: "Urgent + Important — do now", flags: { is_urgent: 1, is_important: 1 } },
  { key: "not_urgent_important", label: "Not urgent + Important — schedule", flags: { is_urgent: 0, is_important: 1 } },
  { key: "urgent_not_important", label: "Urgent + Not important — minimize", flags: { is_urgent: 1, is_important: 0 } },
  { key: "not_urgent_not_important", label: "Neither — drop", flags: { is_urgent: 0, is_important: 0 } },
];

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <TaskCard task={task} />
    </div>
  );
}

function Quad({ q, tasks }: { q: (typeof QUADRANTS)[number]; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: q.key });
  return (
    <div ref={setNodeRef} className={isOver ? "quadrant over" : "quadrant"}>
      <h3>{q.label}</h3>
      {tasks.map((t) => (
        <DraggableCard key={t.id} task={t} />
      ))}
    </div>
  );
}

export function EisenhowerView() {
  const { apiPillar } = usePillarFilter();
  const { data, isLoading } = useEisenhower(apiPillar);
  const invalidate = useInvalidateAll();
  const move = useMutation({
    mutationFn: ({ id, flags }: { id: number; flags: { is_urgent: number; is_important: number } }) =>
      updateTask(id, flags),
    onSuccess: invalidate,
  });
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragStart(e: DragStartEvent) {
    const id = Number(e.active.id);
    const all = data ? QUADRANTS.flatMap((q) => data[q.key]) : [];
    setActive(all.find((t) => t.id === id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const id = Number(e.active.id);
    const target = QUADRANTS.find((q) => q.key === e.over!.id);
    if (target) move.mutate({ id, flags: target.flags });
  }

  if (isLoading || !data) return <p className="muted">Loading matrix…</p>;

  return (
    <div>
      <h2 className="view-title">Eisenhower Matrix</h2>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="matrix">
          {QUADRANTS.map((q) => (
            <Quad key={q.key} q={q} tasks={data[q.key]} />
          ))}
        </div>
        <DragOverlay>{active ? <TaskCard task={active} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
