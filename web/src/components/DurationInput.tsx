const PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
];

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function parseDuration(value: string): number | null {
  const clean = value.trim().toLowerCase();
  if (!clean) return null;
  if (/^\d+$/.test(clean)) return Number(clean);

  let total = 0;
  let matched = false;
  for (const match of clean.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)/g)) {
    matched = true;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return null;
    total += match[2].startsWith("h") ? amount * 60 : amount;
  }
  if (!matched) return null;
  return Math.max(0, Math.round(total));
}

export function DurationInput({
  value,
  onChange,
  label = "Duration",
}: {
  value: number;
  onChange: (minutes: number) => void;
  label?: string;
}) {
  const [text, setText] = useState(formatDuration(value));
  useEffect(() => {
    setText(formatDuration(value));
  }, [value]);
  const preset = PRESETS.find((p) => p.minutes === value);
  return (
    <div className="duration-field">
      <span className="field-label">{label}</span>
      <div className="duration-presets" role="group" aria-label={`${label} presets`}>
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            className={preset?.minutes === p.minutes ? "seg-btn active" : "seg-btn"}
            type="button"
            onClick={() => onChange(p.minutes)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        aria-label={`${label} custom value`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const next = parseDuration(e.target.value);
          if (next != null) onChange(next);
        }}
        onBlur={(e) => {
          const next = parseDuration(e.target.value);
          setText(formatDuration(next ?? value));
        }}
        placeholder="45m or 1h 30m"
      />
    </div>
  );
}
import { useEffect, useState } from "react";
