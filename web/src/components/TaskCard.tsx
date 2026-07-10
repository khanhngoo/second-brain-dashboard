import { useEffect, useState } from "react";
import type { Task } from "../api/types";
import { usePillarLookup } from "./PillarBadge";
import { Clock3, Milestone as MilestoneIcon } from "lucide-react";
import { useMarkTaskDone, useSetTaskStatus } from "../hooks/queries";
import { useTaskDrawer } from "../state/taskDrawer";
import { Checkbox } from "./ui/checkbox";
import { SubtaskList } from "./SubtaskList";
import { formatDuration } from "./DurationInput";

// Compact "stick" task row: checkbox + title, a muted meta line (milestone +
// duration), pillar badge top-right, and an inline collapsible subtask panel.
// The row is clickable and opens the task sheet; the checkbox and subtask panel
// stop propagation so they don't trigger it. Ticking done dims + strikes the
// title and force-collapses the subtask panel (kept short — matrix holds many).
export function TaskCard({ task }: { task: Task; showSubtasks?: boolean }) {
  const lookup = usePillarLookup();
  const status = useSetTaskStatus();
  const markDone = useMarkTaskDone();
  const { openTaskDrawer } = useTaskDrawer();
  const pillar = lookup(task.pillar_id);
  const done = task.status === "done";

  const [subtasksOpen, setSubtasksOpen] = useState(false);
  // Force-collapse when the task is marked done.
  useEffect(() => {
    if (done) setSubtasksOpen(false);
  }, [done]);

  const duration = task.actual_duration_min ? formatDuration(task.actual_duration_min) : null;
  const hasMeta = Boolean(task.milestone_title) || Boolean(duration);

  return (
    <div
      className={done ? "task-card done" : "task-card"}
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
      <div className="task-card-main">
        <span className="task-check" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={done}
            disabled={status.isPending}
            onCheckedChange={(checked) =>
              checked ? markDone(task) : status.mutate({ id: task.id, status: "todo" })
            }
            aria-label={`Mark ${task.title} done`}
          />
        </span>

        <span className="task-body">
          <span className="task-title">{task.title}</span>
          {hasMeta && (
            <span className="task-card-meta">
              {task.milestone_title && (
                <span className="task-meta-item">
                  <MilestoneIcon size={12} aria-hidden="true" />
                  {task.milestone_title}
                </span>
              )}
              {duration && (
                <span className="task-meta-item">
                  <Clock3 size={12} aria-hidden="true" />
                  {duration}
                </span>
              )}
            </span>
          )}
        </span>

        <span className="task-card-right">
          {pillar && (
            <span className="pillar-badge" style={{ borderColor: pillar.color ?? "#888" }}>
              <span className="pillar-swatch" style={{ background: pillar.color ?? "#888" }} />
              {pillar.name}
            </span>
          )}
        </span>
      </div>

      <div
        className="task-card-subtasks"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <SubtaskList taskId={task.id} open={subtasksOpen} onOpenChange={setSubtasksOpen} />
      </div>
    </div>
  );
}
