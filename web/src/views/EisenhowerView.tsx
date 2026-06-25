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
import { Plus } from "lucide-react";
import { updateTask } from "../api/client";
import { useEisenhower, useInvalidateAll } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { useTaskDrawer } from "../state/taskDrawer";
import { TaskCard } from "../components/TaskCard";
import type { Quadrant, Task } from "../api/types";

const QUADRANTS: { key: Quadrant; label: string; tone: string; flags: { is_urgent: number; is_important: number } }[] = [
  { key: "urgent_important", label: "Do now", tone: "Urgent + important", flags: { is_urgent: 1, is_important: 1 } },
  { key: "not_urgent_important", label: "Schedule", tone: "Important, not urgent", flags: { is_urgent: 0, is_important: 1 } },
  { key: "urgent_not_important", label: "Minimize", tone: "Urgent, not important", flags: { is_urgent: 1, is_important: 0 } },
  { key: "not_urgent_not_important", label: "Drop later", tone: "Neither urgent nor important", flags: { is_urgent: 0, is_important: 0 } },
];

function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <TaskCard task={task} />
    </div>
  );
}

function Quad({ q, tasks, onAdd }: { q: (typeof QUADRANTS)[number]; tasks: Task[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: q.key });
  return (
    <div ref={setNodeRef} className={isOver ? "quadrant over" : "quadrant"}>
      <div className="quadrant-head">
        <div>
          <h3>{q.label}</h3>
          <p>{q.tone}</p>
        </div>
        <button className="icon-btn" type="button" onClick={onAdd} aria-label={`Add task to ${q.label}`}>
          <Plus size={16} />
        </button>
      </div>
      {tasks.map((t) => (
        <DraggableCard key={t.id} task={t} />
      ))}
      {tasks.length === 0 && (
        <button className="empty-action" type="button" onClick={onAdd}>
          Add a task here
        </button>
      )}
    </div>
  );
}

export function EisenhowerView() {
  const { apiPillar } = usePillarFilter();
  const { openTaskDrawer } = useTaskDrawer();
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
    <div className="view-stack">
      <div className="view-heading">
        <p className="eyebrow">Decision board</p>
        <h2 className="view-title">Eisenhower Matrix</h2>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="matrix">
          {QUADRANTS.map((q) => (
            <Quad
              key={q.key}
              q={q}
              tasks={data[q.key]}
              onAdd={() =>
                openTaskDrawer({
                  pillar: apiPillar,
                  is_urgent: Boolean(q.flags.is_urgent),
                  is_important: Boolean(q.flags.is_important),
                })
              }
            />
          ))}
        </div>
        <DragOverlay>{active ? <TaskCard task={active} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
