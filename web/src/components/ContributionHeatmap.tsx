import { useMemo } from "react";
import { eachDayOfInterval, format, getDay, startOfWeek, subMonths } from "date-fns";

const LEVEL_THRESHOLDS = [0, 15, 45, 90]; // minutes; index 4 = anything above the last threshold

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

  return (
    <div className="contribution-heatmap">
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
  );
}
