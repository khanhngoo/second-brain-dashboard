import { format } from "date-fns";
import { DurationInput, formatDuration } from "./DurationInput";
import { DatePicker } from "./DatePicker";
import { Input } from "./ui/input";

export type SessionMode = "datetime" | "quick";

export type SessionDraft = {
  mode: SessionMode;
  startDate: Date | undefined;
  startTime: string;
  endDate: Date | undefined;
  endTime: string;
  quickMin: number;
};

// Combine a calendar date and a "HH:mm" time string into a Date.
function combine(date: Date | undefined, time: string): Date | null {
  if (!date) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function makeSessionDraft(): SessionDraft {
  const now = new Date();
  return {
    mode: "quick",
    startDate: now,
    startTime: format(now, "HH:mm"),
    endDate: now,
    endTime: format(now, "HH:mm"),
    // 0 — no default logging. resolveSessionDraft only logs a session when
    // this is > 0, so a save with an untouched Quick tab logs nothing.
    quickMin: 0,
  };
}

// Resolve a draft to session-log params, or null if the draft has no usable duration.
export function resolveSessionDraft(
  draft: SessionDraft
): { duration_min: number; started_at?: string; ended_at?: string } | null {
  if (draft.mode === "quick") {
    return draft.quickMin > 0 ? { duration_min: draft.quickMin } : null;
  }
  const start = combine(draft.startDate, draft.startTime);
  const end = combine(draft.endDate, draft.endTime);
  if (!start || !end) return null;
  const computedMin = Math.round((end.getTime() - start.getTime()) / 60000);
  if (computedMin <= 0) return null;
  return { duration_min: computedMin, started_at: start.toISOString(), ended_at: end.toISOString() };
}

// Presentational duration fields for a task. Two ways to enter time:
//   datetime — pick start/end (date + time); duration is derived.
//   quick    — pick a duration directly (presets or custom), no timestamps.
// The parent owns the draft state and commits it (via updateTask + logSession)
// when the task form is saved — there is no separate save action here.
export function SessionLogger({
  draft,
  onChange,
}: {
  draft: SessionDraft;
  onChange: (next: SessionDraft) => void;
}) {
  const start = combine(draft.startDate, draft.startTime);
  const end = combine(draft.endDate, draft.endTime);
  const computedMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;

  return (
    <div className="session-logger">
      <div className="session-mode-toggle" role="tablist" aria-label="Log mode">
        <button
          type="button"
          role="tab"
          className={draft.mode === "datetime" ? "seg-btn active" : "seg-btn"}
          onClick={() => onChange({ ...draft, mode: "datetime" })}
        >
          Start / end
        </button>
        <button
          type="button"
          role="tab"
          className={draft.mode === "quick" ? "seg-btn active" : "seg-btn"}
          onClick={() => onChange({ ...draft, mode: "quick" })}
        >
          Quick
        </button>
      </div>

      {draft.mode === "datetime" ? (
        <div className="session-datetime">
          <div className="session-row">
            <span className="field-label">Start</span>
            <DatePicker
              value={draft.startDate}
              onChange={(d) => onChange({ ...draft, startDate: d })}
              label="Start date"
            />
            <Input
              type="time"
              className="w-auto"
              value={draft.startTime}
              onChange={(e) => onChange({ ...draft, startTime: e.target.value })}
              aria-label="Start time"
            />
          </div>
          <div className="session-row">
            <span className="field-label">End</span>
            <DatePicker
              value={draft.endDate}
              onChange={(d) => onChange({ ...draft, endDate: d })}
              label="End date"
            />
            <Input
              type="time"
              className="w-auto"
              value={draft.endTime}
              onChange={(e) => onChange({ ...draft, endTime: e.target.value })}
              aria-label="End time"
            />
          </div>
          <p className="session-duration">
            {computedMin != null && computedMin > 0
              ? `Duration: ${formatDuration(computedMin)}`
              : "End must be after start"}
          </p>
        </div>
      ) : (
        <DurationInput
          value={draft.quickMin}
          onChange={(quickMin) => onChange({ ...draft, quickMin })}
          label="Duration"
        />
      )}
    </div>
  );
}
