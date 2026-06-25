import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function sameDay(a: Date, b: Date) {
  return localDateKey(a) === localDateKey(b);
}

export function DateTimeStartPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [visibleMonth]);

  function pickDay(day: Date) {
    const next = new Date(value);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(next);
    setOpen(false);
  }

  function setTime(time: string) {
    const [h, m] = time.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    const next = new Date(value);
    next.setHours(h, m, 0, 0);
    onChange(next);
  }

  return (
    <div className="datetime-field">
      <span className="field-label">Start</span>
      <div className="datetime-grid">
        <div className="popover-wrap">
          <button className="date-trigger" type="button" onClick={() => setOpen((v) => !v)}>
            <CalendarDays size={16} />
            {value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </button>
          {open && (
            <div className="date-popover" role="dialog" aria-label="Choose start date">
              <div className="calendar-head">
                <button
                  className="mini-icon"
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                >
                  <ChevronLeft size={13} />
                </button>
                <strong>{monthLabel(visibleMonth)}</strong>
                <button
                  className="mini-icon"
                  type="button"
                  aria-label="Next month"
                  onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                >
                  <ChevronRight size={13} />
                </button>
              </div>
              <div className="calendar-grid" aria-hidden="true">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={`${d}-${i}`} className="calendar-dow">{d}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {days.map((day) => {
                  const outside = day.getMonth() !== visibleMonth.getMonth();
                  const selected = sameDay(day, value);
                  return (
                    <button
                      key={localDateKey(day)}
                      className={[
                        "calendar-day",
                        outside ? "outside" : "",
                        selected ? "selected" : "",
                      ].filter(Boolean).join(" ")}
                      type="button"
                      onClick={() => pickDay(day)}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <input
          aria-label="Start time"
          type="time"
          value={`${pad(value.getHours())}:${pad(value.getMinutes())}`}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
    </div>
  );
}
