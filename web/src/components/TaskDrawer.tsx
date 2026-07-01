import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createTask, getTask, updateTask } from "../api/client";
import { useMilestones, usePillars, useInvalidateAll } from "../hooks/queries";
import { useTaskDrawer } from "../state/taskDrawer";
import { SessionLogger } from "./SessionLogger";
import { SubtaskList } from "./SubtaskList";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

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
  const [dueDate, setDueDate] = useState("");
  const [effort, setEffort] = useState(false);
  const [impact, setImpact] = useState(false);
  const [noteRef, setNoteRef] = useState("");

  const selectedSlug = pillars?.find((p) => String(p.id) === pillar || p.slug === pillar)?.slug;
  const { data: milestones } = useMilestones(selectedSlug);

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setPillar(String(editingTask.pillar_id));
      setMilestone(editingTask.milestone_id != null ? String(editingTask.milestone_id) : "");
      setDueDate(editingTask.due_date ?? "");
      setEffort(Boolean(editingTask.is_effort));
      setImpact(Boolean(editingTask.is_impact));
      setNoteRef(editingTask.note_ref ?? "");
      return;
    }
    setTitle(draft.title ?? "");
    setPillar(draft.pillar != null ? String(draft.pillar) : "");
    setMilestone(draft.milestone != null ? String(draft.milestone) : "");
    setDueDate(draft.due_date ?? "");
    setEffort(Boolean(draft.is_effort));
    setImpact(Boolean(draft.is_impact));
    setNoteRef(draft.note_ref ?? "");
  }, [draft, editingTask, isOpen]);

  const create = useMutation({
    mutationFn: () =>
      createTask({
        pillar: Number.isFinite(Number(pillar)) ? Number(pillar) : pillar,
        title: title.trim(),
        milestone: cleanNumber(milestone),
        due_date: dueDate || undefined,
        is_impact: impact,
        is_effort: effort,
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
        due_date: dueDate || null,
        is_impact: impact ? 1 : 0,
        is_effort: effort ? 1 : 0,
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closeTaskDrawer(); }}>
      <SheetContent side="right" className="task-sheet">
        <SheetHeader>
          <p className="eyebrow">{editingTaskId != null ? "Task" : "New task"}</p>
          <SheetTitle>{editingTaskId != null ? "Edit useful work" : "Add useful work"}</SheetTitle>
          <SheetDescription className="sr-only">Create or edit a task.</SheetDescription>
        </SheetHeader>

        <div className="sheet-body">
          <form id="task-form" className="drawer-form" onSubmit={submit}>
            <section className="drawer-section">
              <h3 className="drawer-section-title">Details</h3>
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
                <span>Due date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </label>

              <label>
                <span>Note ref</span>
                <input value={noteRef} onChange={(e) => setNoteRef(e.target.value)} placeholder="vault/path.md" />
              </label>

              <div className="choice-row">
                <label className="check-pill">
                  <input type="checkbox" checked={impact} onChange={(e) => setImpact(e.target.checked)} />
                  High impact
                </label>
                <label className="check-pill">
                  <input type="checkbox" checked={effort} onChange={(e) => setEffort(e.target.checked)} />
                  High effort
                </label>
              </div>

              {create.error instanceof Error && <p className="form-error">{create.error.message}</p>}
              {update.error instanceof Error && <p className="form-error">{update.error.message}</p>}
            </section>
          </form>

          {editingTaskId != null && (
            <section className="drawer-section">
              <h3 className="drawer-section-title">Subtasks</h3>
              <SubtaskList taskId={editingTaskId} defaultOpen />
            </section>
          )}

          {editingTaskId != null && (
            <section className="drawer-section">
              <h3 className="drawer-section-title">Log time</h3>
              <SessionLogger taskId={editingTaskId} />
            </section>
          )}
        </div>

        <div className="sheet-footer drawer-actions">
          <button className="btn secondary" type="button" onClick={closeTaskDrawer}>
            Cancel
          </button>
          <button
            className="btn primary"
            type="submit"
            form="task-form"
            disabled={!title.trim() || !pillar || create.isPending || update.isPending}
          >
            {editingTaskId != null
              ? update.isPending ? "Saving..." : "Save task"
              : create.isPending ? "Adding..." : "Add task"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
