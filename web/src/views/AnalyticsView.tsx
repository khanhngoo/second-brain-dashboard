import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePillars, usePillarTime } from "../hooks/queries";
import type { Bucket } from "../api/types";

const BUCKETS: Bucket[] = ["day", "week", "month", "year"];

export function AnalyticsView() {
  const [bucket, setBucket] = useState<Bucket>("week");
  const { data: pillars } = usePillars();
  const { data: timeRows } = usePillarTime(bucket);

  // Aggregate pillar_time rows (one per pillar per bucket) into per-pillar totals.
  const colorOf = (slug: string) => pillars?.find((p) => p.slug === slug)?.color ?? "#888";
  const totals = new Map<string, { name: string; minutes: number; color: string }>();
  for (const r of timeRows ?? []) {
    const cur = totals.get(r.slug) ?? { name: r.name, minutes: 0, color: colorOf(r.slug) };
    cur.minutes += r.minutes;
    totals.set(r.slug, cur);
  }
  const timeData = [...totals.values()];
  const hasTime = timeData.some((d) => d.minutes > 0);

  const countData = (pillars ?? []).map((p) => ({
    name: p.name,
    open_tasks: p.open_tasks,
    active_milestones: p.active_milestones,
    color: p.color ?? "#888",
  }));

  return (
    <div className="view-stack">
      <div className="view-heading">
        <p className="eyebrow">Pillar signal</p>
        <h2 className="view-title">Pillar Analytics</h2>
      </div>

      <section className="section">
        <h3>Open tasks per pillar</h3>
        <div className="metric-panel" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="open_tasks" name="Open tasks">
                {countData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="section">
        <div className="bucket-tabs">
          {BUCKETS.map((b) => (
            <button
              key={b}
              className={bucket === b ? "filter-tab active" : "filter-tab"}
              onClick={() => setBucket(b)}
            >
              {b}
            </button>
          ))}
        </div>
        <h3>Time per pillar ({bucket})</h3>
        {!hasTime ? (
          <p className="empty">No logged time yet for this period.</p>
        ) : (
          <div className="chart-grid">
            <div className="dark-panel" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="minutes" name="Minutes">
                    {timeData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="metric-panel" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={timeData}
                    dataKey="minutes"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                  >
                    {timeData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
