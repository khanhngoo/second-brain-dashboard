import { useState } from "react";
import { useMilestones, useTask } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { ProgressBar } from "../components/ProgressBar";
import { listTasks } from "../api/client";
import { useQuery } from "@tanstack/react-query";
import type { Milestone } from "../api/types";

function MilestoneRow({ m }: { m: Milestone }) {
  const [open, setOpen] = useState(false);
  const { data: tasks } = useQuery({
    queryKey: ["milestone_tasks", m.id],
    queryFn: () => listTasks({ milestone: m.id }),
    enabled: open,
  });
  const label =
    m.total_tasks != null
      ? `${m.done_tasks}/${m.total_tasks}`
      : "no tasks";
  return (
    <div className="panel section">
      <div
        style={{ display: "flex", gap: "1rem", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
      >
        <strong>{open ? "▾" : "▸"} {m.title}</strong>
        <div style={{ flex: 1 }}>
          <ProgressBar fraction={m.progress} label={label} />
        </div>
      </div>
      {open && (
        <div style={{ marginTop: "0.75rem", paddingLeft: "1rem" }}>
          {(tasks ?? []).length === 0 ? (
            <p className="empty">No tasks.</p>
          ) : (
            tasks!.map((t) => <TaskWithSubtasks key={t.id} taskId={t.id} title={t.title} status={t.status} />)
          )}
        </div>
      )}
    </div>
  );
}

function TaskWithSubtasks({ taskId, title, status }: { taskId: number; title: string; status: string }) {
  const { data: detail } = useTask(taskId);
  const total = detail?.subtasks.length ?? 0;
  const done = detail?.subtasks.filter((s) => s.done).length ?? 0;
  return (
    <div className="block-row">
      <span>
        {title} <span className="muted">· {status}</span>
      </span>
      {total > 0 && <span className="muted">{done}/{total} subtasks</span>}
    </div>
  );
}

export function MilestonesView() {
  const { apiPillar } = usePillarFilter();
  const { data: milestones, isLoading } = useMilestones(apiPillar);

  if (isLoading) return <p className="muted">Loading milestones…</p>;

  return (
    <div>
      <h2 className="view-title">Milestone Progress</h2>
      {(milestones ?? []).length === 0 ? (
        <p className="empty">No milestones.</p>
      ) : (
        milestones!.map((m) => <MilestoneRow key={m.id} m={m} />)
      )}
    </div>
  );
}
