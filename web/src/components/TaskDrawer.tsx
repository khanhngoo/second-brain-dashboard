import { KeyboardEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createTask, getTask, logSession, replaceSessions, updateTask } from "../api/client";
import { useMilestones, usePillars, useInvalidateAll } from "../hooks/queries";
import { useTaskDrawer } from "../state/taskDrawer";
import { SessionLogger, makeSessionDraft, resolveSessionDraft, type SessionDraft } from "./SessionLogger";
import { formatDuration } from "./DurationInput";
import { SubtaskList } from "./SubtaskList";
import { DatePicker } from "./DatePicker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Button } from "./ui/button";

const NO_MILESTONE = "__none__";

function cleanNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// due_date is stored/sent as "YYYY-MM-DD" — parse/format in local time so the
// picker doesn't shift a day at UTC offsets.
function parseDateOnly(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatDateOnly(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() => makeSessionDraft());

  // Milestones are pillar-agnostic — show every milestone regardless of the
  // task's chosen pillar.
  const { data: milestones } = useMilestones();

  useEffect(() => {
    if (!isOpen) return;
    if (editingTask) {
      setTitle(editingTask.title);
      setPillar(pillars?.find((p) => p.id === editingTask.pillar_id)?.slug ?? String(editingTask.pillar_id));
      setMilestone(editingTask.milestone_id != null ? String(editingTask.milestone_id) : "");
      setDueDate(editingTask.due_date ?? "");
      setEffort(Boolean(editingTask.is_effort));
      setImpact(Boolean(editingTask.is_impact));
      setNoteRef(editingTask.note_ref ?? "");
      // Pre-fill Quick mode with the task's current total, so the field reads
      // as "the task's time" (edit + save replaces it) rather than a blank
      // "add more time" input.
      setSessionDraft({ ...makeSessionDraft(), quickMin: editingTask.sessions_total_min ?? 0 });
      return;
    }
    setTitle(draft.title ?? "");
    setPillar(draft.pillar != null ? String(draft.pillar) : "");
    setMilestone(draft.milestone != null ? String(draft.milestone) : "");
    setDueDate(draft.due_date ?? "");
    setEffort(Boolean(draft.is_effort));
    setImpact(Boolean(draft.is_impact));
    setNoteRef(draft.note_ref ?? "");
    setSessionDraft(makeSessionDraft());
  }, [draft, editingTask, isOpen, pillars]);

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
    mutationFn: async () => {
      const session = resolveSessionDraft(sessionDraft);
      if (session) {
        if (sessionDraft.mode === "quick") {
          // Quick mode represents the task's total time — replace, don't add.
          await replaceSessions(editingTaskId!, session.duration_min, "manual");
        } else {
          // Start/end mode logs a specific dated session — additive by design.
          await logSession({ task_id: editingTaskId!, source: "manual", ...session });
        }
      }
      const pillarId = pillars?.find((p) => p.slug === pillar)?.id ?? Number(pillar);
      return updateTask(editingTaskId!, {
        pillar_id: pillarId,
        milestone_id: cleanNumber(milestone) ?? null,
        title: title.trim(),
        due_date: dueDate || null,
        is_impact: impact ? 1 : 0,
        is_effort: effort ? 1 : 0,
        note_ref: noteRef.trim() || null,
      });
    },
    onSuccess: async () => {
      // Clear the logged duration so a second save (drawer stays open, or
      // reopens for the same task) doesn't resubmit the same session again.
      setSessionDraft(makeSessionDraft());
      await invalidate();
      closeTaskDrawer();
    },
  });

  function submit(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    if (!title.trim() || !pillar) return;
    if (create.isPending || update.isPending) return;
    if (editingTaskId != null) {
      update.mutate();
      return;
    }
    create.mutate();
  }

  // The Duration section (SessionLogger) sits outside <form>, so Enter there
  // never fires the form's onSubmit. Catch Enter across the whole sheet body and
  // route it to submit — but leave buttons and textareas alone so Enter still
  // activates presets/mode toggles and allows newlines.
  function onSheetKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.target as HTMLElement;
    const tag = el.tagName;
    if (tag === "BUTTON" || tag === "TEXTAREA" || el.isContentEditable) return;
    // Radix Select trigger is a button (handled above); its listbox uses Enter
    // to pick an option — don't hijack that.
    if (el.getAttribute("role") === "option") return;
    submit(e);
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) closeTaskDrawer(); }}>
      <SheetContent side="right" className="task-sheet">
        <SheetHeader>
          <p className="eyebrow">{editingTaskId != null ? "Task" : "New task"}</p>
          <SheetTitle>{editingTaskId != null ? "Edit useful work" : "Add useful work"}</SheetTitle>
          <SheetDescription className="sr-only">Create or edit a task.</SheetDescription>
        </SheetHeader>

        <div className="sheet-body" onKeyDown={onSheetKeyDown}>
          <form id="task-form" onSubmit={submit}>
            <section className="drawer-section">
              <h3 className="drawer-section-title">Details</h3>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="task-title">Title</FieldLabel>
                  <Input
                    id="task-title"
                    className="task-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="task-pillar">Pillar</FieldLabel>
                    <Select value={pillar} onValueChange={setPillar}>
                      <SelectTrigger id="task-pillar">
                        <SelectValue placeholder="Choose pillar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {pillars?.map((p) => (
                            <SelectItem key={p.id} value={p.slug}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="task-milestone">Milestone</FieldLabel>
                    <Select
                      value={milestone || NO_MILESTONE}
                      onValueChange={(v) => setMilestone(v === NO_MILESTONE ? "" : v)}
                    >
                      <SelectTrigger id="task-milestone">
                        <SelectValue placeholder="No milestone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={NO_MILESTONE}>No milestone</SelectItem>
                          {milestones?.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.title}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>Due date</FieldLabel>
                    <DatePicker
                      value={parseDateOnly(dueDate)}
                      onChange={(d) => setDueDate(formatDateOnly(d))}
                      label="Due date"
                      placeholder="No due date"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="task-note-ref">Note ref</FieldLabel>
                    <Input
                      id="task-note-ref"
                      value={noteRef}
                      onChange={(e) => setNoteRef(e.target.value)}
                      placeholder="vault/path.md"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Priority</FieldLabel>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    value={[...(impact ? ["impact"] : []), ...(effort ? ["effort"] : [])]}
                    onValueChange={(values: string[]) => {
                      setImpact(values.includes("impact"));
                      setEffort(values.includes("effort"));
                    }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="impact">High impact</ToggleGroupItem>
                    <ToggleGroupItem value="effort">High effort</ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                {create.error instanceof Error && <p className="form-error">{create.error.message}</p>}
                {update.error instanceof Error && <p className="form-error">{update.error.message}</p>}
              </FieldGroup>
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
              <h3 className="drawer-section-title">Duration</h3>
              {editingTask && (
                <p className="drawer-hint">
                  Currently logged: {formatDuration(editingTask.sessions_total_min ?? 0)}
                </p>
              )}
              <SessionLogger draft={sessionDraft} onChange={setSessionDraft} />
            </section>
          )}
        </div>

        <div className="sheet-footer drawer-actions">
          <Button variant="outline" type="button" onClick={closeTaskDrawer}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="task-form"
            disabled={!title.trim() || !pillar || create.isPending || update.isPending}
          >
            {editingTaskId != null
              ? update.isPending ? "Saving..." : "Save task"
              : create.isPending ? "Adding..." : "Add task"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
