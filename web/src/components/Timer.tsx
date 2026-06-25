import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import { logSession, setTaskStatus } from "../api/client";
import type { Task, TimerMode } from "../api/types";
import { DurationInput } from "./DurationInput";

const DEFAULT_ADHD_MIN = 30;
const POMODORO_PROFILES = {
  "25": { workMin: 25, restMin: 5, label: "25/5" },
  "50": { workMin: 50, restMin: 10, label: "50/10" },
} as const;

type PomodoroProfile = keyof typeof POMODORO_PROFILES;

function fmt(totalSec: number) {
  const s = Math.max(0, Math.abs(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function playAlarm() {
  if (typeof Audio !== "undefined") {
    const audio = new Audio();
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
    void audio.play().catch(() => undefined);
    return;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(150);
  }
}

export function Timer({ task, onDone, compact = false }: { task: Task; onDone?: () => void; compact?: boolean }) {
  const initialMode: TimerMode = task.timer_mode ?? "manual";
  const [mode, setMode] = useState<TimerMode>(initialMode);
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [adhdMin, setAdhdMin] = useState(task.estimated_duration_min ?? DEFAULT_ADHD_MIN);
  const [pomodoroProfile, setPomodoroProfile] = useState<PomodoroProfile>(
    task.estimated_duration_min === 50 ? "50" : "25",
  );
  const [loops, setLoops] = useState(1);
  const startedAtRef = useRef<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertedWorkLoops = useRef(0);
  const completedRef = useRef(false);

  const profile = POMODORO_PROFILES[pomodoroProfile];
  const pomodoro = useMemo(() => {
    const workSec = profile.workMin * 60;
    const restSec = profile.restMin * 60;
    return {
      workSec,
      restSec,
      totalSec: loops * workSec + Math.max(0, loops - 1) * restSec,
      workMin: loops * profile.workMin,
    };
  }, [loops, profile.restMin, profile.workMin]);

  function clear() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  }
  useEffect(() => clear, []);

  function start() {
    startedAtRef.current = new Date().toISOString();
    alertedWorkLoops.current = 0;
    completedRef.current = false;
    setElapsedSec(0);
    setRunning(true);
    tick.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }

  async function logAndMaybeDone(source: "manual" | "pomodoro" | "adhd", durationMin: number, markDone: boolean) {
    clear();
    setRunning(false);
    await logSession({
      task_id: task.id,
      duration_min: Math.max(0, durationMin),
      source,
      started_at: startedAtRef.current ?? undefined,
      ended_at: new Date().toISOString(),
    });
    if (markDone) {
      await setTaskStatus(task.id, "done");
    }
    onDone?.();
  }

  function finishTimer() {
    void logAndMaybeDone("manual", Math.max(0, Math.round(elapsedSec / 60)), true);
  }

  function finishAdhd(markDone = false) {
    void logAndMaybeDone("adhd", adhdMin, markDone);
  }

  function finishPomodoro() {
    void logAndMaybeDone("pomodoro", pomodoro.workMin, false);
  }

  useEffect(() => {
    if (!running || mode !== "pomodoro" || completedRef.current) return;
    for (let i = alertedWorkLoops.current + 1; i <= loops; i += 1) {
      const workEnd = i * pomodoro.workSec + (i - 1) * pomodoro.restSec;
      if (elapsedSec >= workEnd) {
        alertedWorkLoops.current = i;
        playAlarm();
      }
    }
    if (elapsedSec >= pomodoro.totalSec) {
      completedRef.current = true;
      finishPomodoro();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, loops, mode, pomodoro.restSec, pomodoro.totalSec, pomodoro.workSec, running]);

  useEffect(() => {
    if (!running || mode !== "adhd" || completedRef.current) return;
    if (elapsedSec >= adhdMin * 60) {
      completedRef.current = true;
      playAlarm();
      finishAdhd(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adhdMin, elapsedSec, mode, running]);

  const pomodoroPhase = useMemo(() => {
    if (mode !== "pomodoro") return { label: "", remaining: 0 };
    let cursor = elapsedSec;
    for (let i = 1; i <= loops; i += 1) {
      if (cursor < pomodoro.workSec) return { label: `Work ${i}/${loops}`, remaining: pomodoro.workSec - cursor };
      cursor -= pomodoro.workSec;
      if (i < loops) {
        if (cursor < pomodoro.restSec) return { label: "Rest", remaining: pomodoro.restSec - cursor };
        cursor -= pomodoro.restSec;
      }
    }
    return { label: "Done", remaining: 0 };
  }, [elapsedSec, loops, mode, pomodoro.restSec, pomodoro.workSec]);

  const display = mode === "pomodoro"
    ? fmt(pomodoroPhase.remaining)
    : mode === "adhd"
      ? fmt(adhdMin * 60 - elapsedSec)
      : fmt(elapsedSec);

  return (
    <div className={compact ? "timer compact" : "timer"}>
      {!running && (
        <select value={mode} onChange={(e) => setMode(e.target.value as TimerMode)} aria-label="Timer mode">
          <option value="manual">Timer</option>
          <option value="pomodoro">Pomodoro</option>
          <option value="adhd">ADHD</option>
        </select>
      )}
      {!compact && !running && mode === "pomodoro" && (
        <div className="timer-options">
          <select
            value={pomodoroProfile}
            onChange={(e) => setPomodoroProfile(e.target.value as PomodoroProfile)}
            aria-label="Pomodoro ratio"
          >
            {Object.entries(POMODORO_PROFILES).map(([value, p]) => (
              <option key={value} value={value}>{p.label}</option>
            ))}
          </select>
          <label className="loop-input">
            <span>Loops</span>
            <input
              aria-label="Pomodoro loops"
              inputMode="numeric"
              value={loops}
              onChange={(e) => setLoops(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
      )}
      {!compact && !running && mode === "adhd" && <DurationInput label="ADHD duration" value={adhdMin} onChange={setAdhdMin} />}
      <span className="timer-readout">
        {mode === "pomodoro" && <span className="phase-label">{pomodoroPhase.label || `${profile.label} x ${loops}`}</span>}
        <span className="clock">{display}</span>
      </span>
      {!running ? (
        <button className="btn secondary icon-label" onClick={start} aria-label={compact ? "Start timer" : undefined}>
          <Play size={14} />
          {compact ? "" : "Start"}
        </button>
      ) : mode === "manual" ? (
        <button className="btn primary icon-label" onClick={finishTimer} aria-label={compact ? "Finish timer" : undefined}>
          <Check size={14} />
          {compact ? "" : "Finish"}
        </button>
      ) : mode === "adhd" ? (
        <button className="btn primary icon-label" onClick={() => finishAdhd(true)} aria-label={compact ? "Finish ADHD timer" : undefined}>
          <Check size={14} />
          {compact ? "" : "Finish"}
        </button>
      ) : (
        <button className="btn secondary icon-label" onClick={finishPomodoro} aria-label={compact ? "Log pomodoro now" : undefined}>
          <Check size={14} />
          {compact ? "" : "Log now"}
        </button>
      )}
    </div>
  );
}
