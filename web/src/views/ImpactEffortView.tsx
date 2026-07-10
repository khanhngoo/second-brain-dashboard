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
import { Inbox, Plus } from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { updateTask } from "../api/client";
import { useImpactEffort, useInvalidateAll } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { useTaskDrawer } from "../state/taskDrawer";
import { TaskCard } from "../components/TaskCard";
import { usePillarLookup } from "../components/PillarBadge";
import type { Quadrant, Task } from "../api/types";

const QUADRANTS: { key: Quadrant; label: string; tone: string; flags: { is_impact: number; is_effort: number } }[] = [
  { key: "high_impact_low_effort", label: "Quick Wins", tone: "High impact · low effort", flags: { is_impact: 1, is_effort: 0 } },
  { key: "high_impact_high_effort", label: "Major Projects", tone: "High impact · high effort", flags: { is_impact: 1, is_effort: 1 } },
  { key: "low_impact_low_effort", label: "Fill-ins", tone: "Low impact · low effort", flags: { is_impact: 0, is_effort: 0 } },
  { key: "low_impact_high_effort", label: "Thankless", tone: "Low impact · high effort", flags: { is_impact: 0, is_effort: 1 } },
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
          <Inbox size={20} className="muted-icon" />
          <span>Nothing here yet — drag a card in or add a task</span>
        </button>
      )}
    </div>
  );
}

export function ImpactEffortView() {
  const { matches } = usePillarFilter();
  const { openTaskDrawer } = useTaskDrawer();
  const lookup = usePillarLookup();
  const { data, isLoading } = useImpactEffort();
  const invalidate = useInvalidateAll();

  // Client-side pillar filter: keep only cards whose pillar slug is selected.
  const keep = (t: Task) => matches(lookup(t.pillar_id)?.slug);
  const move = useMutation({
    mutationFn: ({ id, flags }: { id: number; flags: { is_impact: number; is_effort: number } }) =>
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

  if (isLoading || !data) {
    return (
      <div className="view-stack wide">
        <div className="view-heading">
          <p className="eyebrow">Decision board</p>
          <h2 className="view-title">Impact / Effort Matrix</h2>
        </div>
        <div className="matrix">
          {QUADRANTS.map((q) => (
            <div className="quadrant" key={q.key}>
              <Skeleton style={{ width: 140, height: 28 }} />
              <Skeleton style={{ height: 52 }} />
              <Skeleton style={{ height: 52 }} />
              <Skeleton style={{ height: 52, opacity: 0.6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="view-stack wide">
      <div className="view-heading">
        <p className="eyebrow">Decision board</p>
        <h2 className="view-title">Impact / Effort Matrix</h2>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="matrix">
          {QUADRANTS.map((q) => (
            <Quad
              key={q.key}
              q={q}
              tasks={data[q.key].filter(keep)}
              onAdd={() =>
                openTaskDrawer({
                  is_impact: Boolean(q.flags.is_impact),
                  is_effort: Boolean(q.flags.is_effort),
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
