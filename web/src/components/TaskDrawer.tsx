import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createTask, getTask, updateTask } from "../api/client";
import { useMilestones, usePillars, useInvalidateAll } from "../hooks/queries";
import { useTaskDrawer } from "../state/taskDrawer";
import type { TimerMode } from "../api/types";
import { DurationInput } from "./DurationInput";

function cleanNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function TaskDrawer() {
  const { isOpen, draft, closeTaskDrawer } = useTaskDrawer();
  const invalidate = useInvalidateAll();
  const { data: pillars } = usePillars();
  const editingTaskId = draft.taskId;
  const { data: editingTask } = useQuery({
    queryKey: editingTaskId ? ["task", editingTaskId] : ["task", "drawer", "none"],
    queryFn: () => getTask(editingTaskId!),
    enabled: isOpen && editingTaskId != null,
  });

  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState("");
  const [milestone, setMilestone] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState(30);
  const [timerMode, setTimerMode] = useState<TimerMode>("manual");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);
  const [noteRef, setNoteRef] = useState("");

  const selectedSlug = pillars?.find((p) => String(p.id) === pillar || p.slug === pillar)?.slug;
  const { data: milestones } = useMilestones(selectedSlug);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setPillar(String(editingTask.pillar_id));
      setMilestone(editingTask.milestone_id != null ? String(editingTask.milestone_id) : "");
      setDescription(editingTask.description ?? "");
      setDueDate(editingTask.due_date ?? "");
      setEstimate(editingTask.estimated_duration_min ?? 30);
      setTimerMode(editingTask.timer_mode ?? "manual");
      setUrgent(Boolean(editingTask.is_urgent));
      setImportant(Boolean(editingTask.is_important));
      setNoteRef(editingTask.note_ref ?? "");
      return;
    }
    setTitle(draft.title ?? "");
    setPillar(draft.pillar != null ? String(draft.pillar) : "");
    setMilestone(draft.milestone != null ? String(draft.milestone) : "");
    setDescription(draft.description ?? "");
    setDueDate(draft.due_date ?? "");
    setEstimate(draft.estimated_duration_min ?? 30);
    setTimerMode(draft.timer_mode ?? "manual");
    setUrgent(Boolean(draft.is_urgent));
    setImportant(Boolean(draft.is_important));
    setNoteRef(draft.note_ref ?? "");
  }, [draft, editingTask, isOpen]);

  const create = useMutation({
    mutationFn: () =>
      createTask({
        pillar: Number.isFinite(Number(pillar)) ? Number(pillar) : pillar,
        title: title.trim(),
        milestone: cleanNumber(milestone),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        estimated_duration_min: estimate,
        timer_mode: timerMode,
        is_urgent: urgent,
        is_important: important,
        note_ref: noteRef.trim() || undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      closeTaskDrawer();
    },
  });
  const update = useMutation({
    mutationFn: () =>
      updateTask(editingTaskId!, {
        pillar_id: Number(pillar),
        milestone_id: cleanNumber(milestone) ?? null,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        estimated_duration_min: estimate,
        timer_mode: timerMode,
        is_urgent: urgent ? 1 : 0,
        is_important: important ? 1 : 0,
        note_ref: noteRef.trim() || null,
      }),
    onSuccess: async () => {
      await invalidate();
      closeTaskDrawer();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !pillar) return;
    if (editingTaskId != null) {
      update.mutate();
      return;
    }
    create.mutate();
  }

  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="task-drawer" role="dialog" aria-modal="true" aria-label={editingTaskId != null ? "Edit task" : "Add task"}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">{editingTaskId != null ? "Task" : "New task"}</p>
            <h2>{editingTaskId != null ? "Edit useful work" : "Add useful work"}</h2>
          </div>
          <button className="icon-btn" type="button" onClick={closeTaskDrawer} aria-label="Close task drawer">
            <X size={18} />
          </button>
        </div>

        <form className="drawer-form" onSubmit={submit}>
          <label>
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>

          <label>
            <span>Pillar</span>
            <select value={pillar} onChange={(e) => setPillar(e.target.value)}>
              <option value="">Choose pillar</option>
              {pillars?.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Milestone</span>
            <select value={milestone} onChange={(e) => setMilestone(e.target.value)}>
              <option value="">No milestone</option>
              {milestones?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </label>

          <div className="form-grid">
            <label>
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <DurationInput value={estimate} onChange={setEstimate} />
          </div>

          <div className="form-grid">
            <label>
              <span>Timer</span>
              <select value={timerMode} onChange={(e) => setTimerMode(e.target.value as TimerMode)}>
                <option value="manual">Timer</option>
                <option value="pomodoro">Pomodoro</option>
                <option value="adhd">ADHD</option>
              </select>
            </label>
            <label>
              <span>Note ref</span>
              <input value={noteRef} onChange={(e) => setNoteRef(e.target.value)} placeholder="vault/path.md" />
            </label>
          </div>

          <div className="choice-row">
            <label className="check-pill">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              Urgent
            </label>
            <label className="check-pill">
              <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
              Important
            </label>
          </div>

          {create.error instanceof Error && <p className="form-error">{create.error.message}</p>}
          {update.error instanceof Error && <p className="form-error">{update.error.message}</p>}

          <div className="drawer-actions">
            <button className="btn secondary" type="button" onClick={closeTaskDrawer}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={!title.trim() || !pillar || create.isPending || update.isPending}>
              {editingTaskId != null
                ? update.isPending ? "Saving..." : "Save task"
                : create.isPending ? "Adding..." : "Add task"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
