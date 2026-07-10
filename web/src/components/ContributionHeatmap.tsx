import { useEffect, useMemo, useRef } from "react";
import { eachDayOfInterval, format, getDay, startOfWeek, subDays, subMonths } from "date-fns";

const LEVEL_THRESHOLDS = [0, 15, 45, 90]; // minutes; index 4 = anything above the last threshold
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]; // Sun-first rows; label alternate rows

function levelFor(minutes: number): number {
  if (minutes <= 0) return 0;
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (minutes >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function ContributionHeatmap({ data }: { data: { day: string; minutes: number }[] }) {
  const minutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) map.set(d.day, d.minutes);
    return map;
  }, [data]);

  const weeks = useMemo(() => {
    const today = new Date();
    const rangeStart = startOfWeek(subMonths(today, 12));
    const days = eachDayOfInterval({ start: rangeStart, end: today });

    const cols: { date: Date; key: string; minutes: number }[][] = [];
    let currentWeek: { date: Date; key: string; minutes: number }[] = [];
    for (const date of days) {
      const key = format(date, "yyyy-MM-dd");
      currentWeek.push({ date, key, minutes: minutesByDay.get(key) ?? 0 });
      if (getDay(date) === 6) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length) cols.push(currentWeek);
    return cols;
  }, [minutesByDay]);

  // One label per month, placed at the first week column whose first day
  // enters that month. Skip a label that would collide with the previous one.
  const monthLabels = useMemo(() => {
    const labels: { col: number; text: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const first = week[0].date;
      const month = first.getMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        const prev = labels[labels.length - 1];
        if (!prev || col - prev.col >= 3) labels.push({ col, text: format(first, "MMM") });
      }
    });
    return labels;
  }, [weeks]);

  const stats = useMemo(() => {
    let totalMinutes = 0;
    let activeDays = 0;
    for (const minutes of minutesByDay.values()) {
      if (minutes > 0) {
        totalMinutes += minutes;
        activeDays += 1;
      }
    }
    // Current streak: walk back from today; a quiet today doesn't break a
    // streak that ran through yesterday.
    let streak = 0;
    let cursor = new Date();
    if ((minutesByDay.get(format(cursor, "yyyy-MM-dd")) ?? 0) <= 0) cursor = subDays(cursor, 1);
    while ((minutesByDay.get(format(cursor, "yyyy-MM-dd")) ?? 0) > 0) {
      streak += 1;
      cursor = subDays(cursor, 1);
    }
    return { totalHours: (totalMinutes / 60).toFixed(1), activeDays, streak };
  }, [minutesByDay]);

  // The 12-month grid overflows; land the scroll on the most recent weeks.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks]);

  return (
    <div className="contribution-heatmap-wrap">
      <div className="heatmap-summary">
        <span><strong>{stats.totalHours}h</strong> logged</span>
        <span><strong>{stats.activeDays}</strong> active days</span>
        <span><strong>{stats.streak}</strong> day streak</span>
      </div>
      <div className="contribution-heatmap">
        <div className="contribution-heatmap-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
        <div className="contribution-heatmap-scroll" ref={scrollRef}>
          <div className="contribution-heatmap-months" aria-hidden="true">
            {monthLabels.map((m) => (
              <span key={`${m.text}-${m.col}`} style={{ gridColumnStart: m.col + 1 }}>
                {m.text}
              </span>
            ))}
          </div>
          <div className="contribution-heatmap-grid">
            {weeks.map((week, wi) => (
              <div className="contribution-heatmap-col" key={wi}>
                {week.map((cell) => (
                  <div
                    key={cell.key}
                    className="contribution-heatmap-cell"
                    data-level={levelFor(cell.minutes)}
                    title={`${format(cell.date, "MMM d, yyyy")}: ${cell.minutes} min`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
