import type { Task } from "../api/types";
import { usePillarLookup } from "./PillarBadge";
import { CalendarDays, CheckCircle2, Clock3, Flag, PlayCircle } from "lucide-react";
import { useSetTaskStatus } from "../hooks/queries";
import { Timer } from "./Timer";

export function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
  const lookup = usePillarLookup();
  const status = useSetTaskStatus();
  const color = lookup(task.pillar_id)?.color ?? "#888";
  return (
    <div className="task-card" style={{ borderLeftColor: color }}>
      <div className="task-card-head">
        <div>
          <div className="task-title">{task.title}</div>
          <div className="task-pillar">{lookup(task.pillar_id)?.name ?? "Unknown pillar"}</div>
        </div>
        <select
          className="status-select"
          value={task.status}
          disabled={status.isPending}
          onChange={(e) => status.mutate({ id: task.id, status: e.target.value })}
          aria-label={`Status for ${task.title}`}
        >
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="task-meta">
        {task.due_date && (
          <span className="due">
            <CalendarDays size={13} /> {task.due_date.slice(0, 10)}
          </span>
        )}
        {task.estimated_duration_min != null && (
          <span className="est">
            <Clock3 size={13} /> {task.estimated_duration_min}m
          </span>
        )}
        {(task.is_urgent || task.is_important) && (
          <span className="flags">
            <Flag size={13} />
            {task.is_urgent ? "Urgent" : ""}
            {task.is_urgent && task.is_important ? " + " : ""}
            {task.is_important ? "Important" : ""}
          </span>
        )}
        {task.status === "done" && (
          <span className="done-chip">
            <CheckCircle2 size={13} /> Done
          </span>
        )}
      </div>
      {!compact && (
        <div className="task-timer-row">
          <PlayCircle size={15} />
          <Timer task={task} compact />
        </div>
      )}
    </div>
  );
}
