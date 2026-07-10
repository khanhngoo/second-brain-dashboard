import { Cell, Pie, PieChart } from "recharts";
import type { TimeBlock } from "../api/types";

export function sumBlockMinutes(blocks: TimeBlock[]): number {
  return blocks.reduce((total, block) => {
    const start = new Date(block.start_at).getTime();
    const end = new Date(block.end_at).getTime();
    return total + Math.max(0, (end - start) / 60_000);
  }, 0);
}

export function TimeProgressDonut({
  spentMin,
  scheduledMin,
  size = 24,
}: {
  spentMin: number;
  scheduledMin: number;
  size?: number;
}) {
  const spent = Math.max(0, spentMin);
  const remaining = Math.max(0, scheduledMin - spent);
  const data =
    scheduledMin > 0
      ? [
          { name: "spent", value: spent, color: "var(--accent, #4f7cff)" },
          { name: "remaining", value: remaining, color: "var(--hairline, #dcdcdc)" },
        ]
      : [{ name: "empty", value: 1, color: "var(--hairline, #dcdcdc)" }];

  return (
    <PieChart width={size} height={size}>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={size * 0.32}
        outerRadius={size * 0.5}
        isAnimationActive={false}
        stroke="none"
      >
        {data.map((d, i) => (
          <Cell key={i} fill={d.color} />
        ))}
      </Pie>
    </PieChart>
  );
}
