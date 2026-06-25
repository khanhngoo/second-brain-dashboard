import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { addSubtask, createMilestone, listTasks, toggleSubtask } from "../api/client";
import { useMilestones, usePillars, useTask, useInvalidateAll } from "../hooks/queries";
import { usePillarFilter } from "../state/pillarFilter";
import { useTaskDrawer } from "../state/taskDrawer";
import { ProgressBar } from "../components/ProgressBar";
import { Timer } from "../components/Timer";
import type { Milestone } from "../api/types";

function MilestoneRow({ m }: { m: Milestone }) {
  const [open, setOpen] = useState(false);
  const { openTaskDrawer } = useTaskDrawer();
  const { data: pillars } = usePillars();
  const pillarSlug = pillars?.find((p) => p.id === m.pillar_id)?.slug ?? m.pillar_id;
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
    <article className="milestone-card">
      <div className="milestone-head">
        <button
          className="icon-btn"
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse milestone" : "Expand milestone"}
        >
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </button>
        <button className="milestone-title" type="button" onClick={() => setOpen((o) => !o)}>
          <strong>{m.title}</strong>
          <span>{m.target_date ? `Target ${m.target_date.slice(0, 10)}` : "No target date"}</span>
        </button>
        <div className="milestone-progress">
          <ProgressBar fraction={m.progress} label={label} />
        </div>
        <button
          className="btn secondary icon-label"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTaskDrawer({ pillar: pillarSlug, milestone: m.id });
          }}
        >
          <Plus size={15} />
          Task
        </button>
      </div>
      {open && (
        <div className="milestone-body">
          {(tasks ?? []).length === 0 ? (
            <p className="empty">No tasks.</p>
          ) : (
            tasks!.map((t) => (
              <TaskWithSubtasks
                key={t.id}
                taskId={t.id}
                title={t.title}
                status={t.status}
              />
            ))
          )}
        </div>
      )}
    </article>
  );
}

function TaskWithSubtasks({
  taskId,
  title,
  status,
}: {
  taskId: number;
  title: string;
  status: string;
}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const { data: detail } = useTask(taskId);
  const total = detail?.subtasks.length ?? 0;
  const done = detail?.subtasks.filter((s) => s.done).length ?? 0;
  const invalidate = useInvalidateAll();
  const toggle = useMutation({ mutationFn: toggleSubtask, onSuccess: invalidate });
  const add = useMutation({
    mutationFn: (value: string) => addSubtask(taskId, value),
    onSuccess: () => {
      setSubtaskTitle("");
      invalidate();
    },
  });
  return (
    <div className="milestone-task">
      <div className="milestone-task-head">
        <span>
          {title} <span className="muted">· {status}</span>
        </span>
        <span className="muted">{done}/{total} subtasks</span>
      </div>
      {detail && <Timer task={detail} compact />}
      <div className="subtask-list">
        {detail?.subtasks.map((s) => (
          <button key={s.id} className="subtask" type="button" onClick={() => toggle.mutate(s.id)}>
            <CheckCircle2 size={14} className={s.done ? "checked" : ""} />
            {s.title}
          </button>
        ))}
      </div>
      <div className="inline-form">
        <input value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} placeholder="Add subtask" />
        <button
          className="btn secondary"
          type="button"
          onClick={() => add.mutate(subtaskTitle.trim())}
          disabled={!subtaskTitle.trim() || add.isPending}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function MilestonesView() {
  const { apiPillar } = usePillarFilter();
  const { data: pillars } = usePillars();
  const { data: milestones, isLoading } = useMilestones(apiPillar);
  const invalidate = useInvalidateAll();
  const [newTitle, setNewTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const selectedPillar = apiPillar ?? pillars?.[0]?.slug ?? "";
  const create = useMutation({
    mutationFn: () =>
      createMilestone({
        pillar: selectedPillar,
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
        <button className="btn primary icon-label" type="submit" disabled={!newTitle.trim() || !selectedPillar}>
          <Plus size={15} />
          Milestone
        </button>
      </form>
      {(milestones ?? []).length === 0 ? (
        <p className="empty">No milestones.</p>
      ) : (
        milestones!.map((m) => <MilestoneRow key={m.id} m={m} />)
      )}
    </div>
  );
}
