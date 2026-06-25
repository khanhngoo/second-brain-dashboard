import { FormEvent, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { moveTimeBlock } from "../api/client";
import { useInvalidateAll } from "../hooks/queries";
import { useBlockDrawer } from "../state/blockDrawer";
import { DateTimeStartPicker } from "./DateTimeStartPicker";
import { DurationInput } from "./DurationInput";

function durationMinutes(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

function toLocalIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":00",
  ].join("");
}

export function BlockDrawer() {
  const { isOpen, draft, closeBlockDrawer } = useBlockDrawer();
  const invalidate = useInvalidateAll();
  const [start, setStart] = useState(() => new Date());
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    if (!draft) return;
    setStart(new Date(draft.block.start_at));
    setDuration(durationMinutes(draft.block.start_at, draft.block.end_at));
  }, [draft]);

  const end = useMemo(() => new Date(start.getTime() + duration * 60_000), [duration, start]);
  const save = useMutation({
    mutationFn: () =>
      moveTimeBlock(draft!.block.id, toLocalIso(start), toLocalIso(end)),
    onSuccess: async () => {
      await invalidate();
      closeBlockDrawer();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || duration <= 0) return;
    save.mutate();
  }

  if (!isOpen || !draft) return null;

  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="task-drawer" role="dialog" aria-modal="true" aria-label="Edit block">
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Time block</p>
            <h2>Edit block</h2>
          </div>
          <button className="icon-btn" type="button" onClick={closeBlockDrawer} aria-label="Close block drawer">
            <X size={18} />
          </button>
        </div>

        <form className="drawer-form" onSubmit={submit}>
          <div className="drawer-summary">
            <span className="field-label">Task</span>
            <strong>{draft.title ?? `Task #${draft.block.task_id}`}</strong>
          </div>
          <DateTimeStartPicker value={start} onChange={setStart} />
          <DurationInput value={duration} onChange={setDuration} />
          <p className="muted">
            Ends at {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>

          {save.error instanceof Error && <p className="form-error">{save.error.message}</p>}

          <div className="drawer-actions">
            <button className="btn secondary" type="button" onClick={closeBlockDrawer}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={duration <= 0 || save.isPending}>
              {save.isPending ? "Saving..." : "Save block"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
