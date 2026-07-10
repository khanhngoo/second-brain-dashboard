import { useState } from "react";
import { replaceSessions } from "../api/client";
import { useInvalidateAll } from "../hooks/queries";
import { useDurationPrompt } from "../state/durationPrompt";
import { DurationInput } from "./DurationInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

// Fires when a task is marked done with nothing logged — asks for the time
// spent so the task doesn't silently complete with a 0-minute total.
export function DurationPromptDialog() {
  const { pending, clearDuration } = useDurationPrompt();
  const invalidate = useInvalidateAll();
  const [minutes, setMinutes] = useState(0);
  const [saving, setSaving] = useState(false);

  const open = pending !== null;

  function reset() {
    setMinutes(0);
    setSaving(false);
    clearDuration();
  }

  async function save() {
    if (!pending) return;
    setSaving(true);
    await replaceSessions(pending.id, minutes, "manual");
    invalidate();
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && reset()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time for "{pending?.title}"</DialogTitle>
          <DialogDescription>
            Marked done with nothing logged. Add how long it took to complete the record.
          </DialogDescription>
        </DialogHeader>
        <DurationInput value={minutes} onChange={setMinutes} label="Time spent" />
        <DialogFooter>
          <button className="btn" type="button" onClick={reset} disabled={saving}>
            Not now
          </button>
          <button className="btn primary" type="button" onClick={save} disabled={saving}>
            Log time
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
