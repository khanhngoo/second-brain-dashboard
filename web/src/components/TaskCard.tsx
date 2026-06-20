import type { Task } from "../api/types";
import { usePillarLookup } from "./PillarBadge";

export function TaskCard({ task }: { task: Task }) {
  const lookup = usePillarLookup();
  const color = lookup(task.pillar_id)?.color ?? "#888";
  return (
    <div className="task-card" style={{ borderLeftColor: color }}>
      <div className="task-title">{task.title}</div>
      <div className="task-meta">
        {task.due_date && <span className="due">📅 {task.due_date.slice(0, 10)}</span>}
        {task.estimated_duration_min != null && (
          <span className="est">⏱ {task.estimated_duration_min}m</span>
        )}
        {(task.is_urgent || task.is_important) && (
          <span className="flags">
            {task.is_urgent ? "U" : ""}
            {task.is_important ? "I" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
