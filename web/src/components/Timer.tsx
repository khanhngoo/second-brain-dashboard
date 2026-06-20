import { useEffect, useRef, useState } from "react";
import { logSession, setTaskStatus } from "../api/client";
import type { Task, TimerMode } from "../api/types";

const DEFAULT_POMODORO_MIN = 25;

function fmt(totalSec: number) {
  const sign = totalSec < 0 ? "-" : "";
  const s = Math.abs(totalSec);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${sign}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * The three time-tracking paths (docs/04), run in-UI; the backend just persists
 * the resulting session on stop.
 *
 *  - Pomodoro: counts DOWN from estimated_duration_min (fallback 25). At zero it
 *    auto-logs the FULL box (source=pomodoro). Status untouched.
 *  - Manual: counts UP, keeps running past the estimate (overtime tracked).
 *    Stop -> log elapsed (source=manual), status unchanged.
 *    Done -> log elapsed AND set status done (two separate writes).
 */
export function Timer({ task, onDone }: { task: Task; onDone?: () => void }) {
  const initialMode: TimerMode = task.timer_mode ?? "manual";
  const [mode, setMode] = useState<TimerMode>(initialMode);
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const boxMin = task.estimated_duration_min ?? DEFAULT_POMODORO_MIN;
  const boxSec = boxMin * 60;

  function clear() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  }
  useEffect(() => clear, []);

  function start() {
    startedAtRef.current = new Date().toISOString();
    setElapsedSec(0);
    setRunning(true);
    tick.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }

  async function finishPomodoro() {
    clear();
    setRunning(false);
    await logSession({
      task_id: task.id,
      duration_min: boxMin, // pomodoro logs the full box, not the elapsed
      source: "pomodoro",
      started_at: startedAtRef.current ?? undefined,
      ended_at: new Date().toISOString(),
    });
    onDone?.();
  }

  // Pomodoro auto-completes when the countdown hits zero.
  useEffect(() => {
    if (mode === "pomodoro" && running && elapsedSec >= boxSec) {
      void finishPomodoro();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, mode, running, boxSec]);

  async function stopManual(markDone: boolean) {
    clear();
    setRunning(false);
    const minutes = Math.max(0, Math.round(elapsedSec / 60));
    await logSession({
      task_id: task.id,
      duration_min: minutes,
      source: "manual",
      started_at: startedAtRef.current ?? undefined,
      ended_at: new Date().toISOString(),
    });
    if (markDone) {
      // Separate write — preserves the session-vs-status split.
      await setTaskStatus(task.id, "done");
    }
    onDone?.();
  }

  const remaining = boxSec - elapsedSec;
  const display = mode === "pomodoro" ? fmt(remaining) : fmt(elapsedSec);
  const overtime = mode === "manual" && elapsedSec > boxSec;

  return (
    <div className="timer">
      {!running && (
        <select value={mode} onChange={(e) => setMode(e.target.value as TimerMode)}>
          <option value="manual">Manual</option>
          <option value="pomodoro">Pomodoro</option>
        </select>
      )}
      <span className={overtime ? "clock overtime" : "clock"}>{display}</span>
      {!running ? (
        <button className="btn" onClick={start}>
          Start
        </button>
      ) : mode === "pomodoro" ? (
        <button className="btn" onClick={finishPomodoro}>
          Log box now
        </button>
      ) : (
        <span className="btn-row">
          <button className="btn" onClick={() => stopManual(false)}>
            Stop
          </button>
          <button className="btn" onClick={() => stopManual(true)}>
            Done
          </button>
        </span>
      )}
    </div>
  );
}
