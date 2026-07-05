import { useMemo, useState } from "react";
import { endOfDay, format, startOfDay, subDays, subMonths, subYears } from "date-fns";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../components/ui/chart";
import { Checkbox } from "../components/ui/checkbox";
import { ContributionHeatmap } from "../components/ContributionHeatmap";
import { usePillars, usePillarTime } from "../hooks/queries";

type Range = "day" | "week" | "month" | "year" | "all";
const RANGES: Range[] = ["day", "week", "month", "year", "all"];

// Lookback window per range option. "all" has no lower bound.
function rangeStartFor(range: Range): Date | null {
  const now = new Date();
  switch (range) {
    case "day":
      return subDays(now, 1);
    case "week":
      return subDays(now, 7);
    case "month":
      return subMonths(now, 1);
    case "year":
      return subYears(now, 1);
    case "all":
      return null;
  }
}

export function AnalyticsView() {
  const [range, setRange] = useState<Range>("week");
  const { data: pillars } = usePillars();
  const [selected, setSelected] = useState<Set<string> | "all">("all");

  const start = rangeStartFor(range);
  const { data: radarRows } = usePillarTime(
    "day",
    start ? format(startOfDay(start), "yyyy-MM-dd") : undefined,
    format(endOfDay(new Date()), "yyyy-MM-dd")
  );

  const heatmapStart = subMonths(new Date(), 12);
  const { data: heatmapRows } = usePillarTime(
    "day",
    format(startOfDay(heatmapStart), "yyyy-MM-dd"),
    format(endOfDay(new Date()), "yyyy-MM-dd")
  );

  const pillarChartConfig = useMemo(() => {
    return (pillars ?? []).reduce<ChartConfig>((config, p) => {
      config[p.slug] = { label: p.name, color: p.color ?? "#888" };
      return config;
    }, {});
  }, [pillars]);

  const isSelected = (slug: string) => selected === "all" || selected.has(slug);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const all = (pillars ?? []).map((p) => p.slug);
      const current = prev === "all" ? new Set(all) : new Set(prev);
      if (current.has(slug)) current.delete(slug);
      else current.add(slug);
      return current.size === all.length ? "all" : current;
    });
  };

  const toggleAll = () => setSelected("all");

  const radarData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of radarRows ?? []) {
      totals.set(r.slug, (totals.get(r.slug) ?? 0) + r.minutes);
    }
    return (pillars ?? [])
      .filter((p) => isSelected(p.slug))
      .map((p) => ({
        slug: p.slug,
        pillar: p.name,
        minutes: totals.get(p.slug) ?? 0,
      }));
  }, [radarRows, pillars, selected]);
  const hasRadarData = radarData.length > 0;

  const heatmapData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of heatmapRows ?? []) {
      if (r.bucket === null) continue;
      byDay.set(r.bucket, (byDay.get(r.bucket) ?? 0) + r.minutes);
    }
    return [...byDay.entries()].map(([day, minutes]) => ({ day, minutes }));
  }, [heatmapRows]);

  return (
    <div className="view-stack">
      <div className="view-heading">
        <p className="eyebrow">Pillar signal</p>
        <h2 className="view-title">Pillar Analytics</h2>
      </div>

      <div className="chart-grid analytics-grid">
        <div className="metric-panel analytics-panel">
          <h3>Contribution activity (last 12 months)</h3>
          <ContributionHeatmap data={heatmapData} />
        </div>

        <div className="metric-panel analytics-panel">
          <div className="analytics-radar-head">
            <h3>Pillar balance</h3>
            <div className="bucket-tabs">
              {RANGES.map((r) => (
                <button
                  key={r}
                  className={range === r ? "filter-tab active" : "filter-tab"}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="analytics-pillar-select">
            <label className="analytics-pillar-option">
              <Checkbox checked={selected === "all"} onCheckedChange={toggleAll} />
              <span>All</span>
            </label>
            {(pillars ?? []).map((p) => (
              <label key={p.slug} className="analytics-pillar-option">
                <Checkbox checked={isSelected(p.slug)} onCheckedChange={() => toggle(p.slug)} />
                <span style={{ color: p.color ?? undefined }}>{p.name}</span>
              </label>
            ))}
          </div>

          {!hasRadarData ? (
            <p className="empty">No logged time yet for this period.</p>
          ) : (
            <div style={{ height: 320 }}>
              <ChartContainer config={pillarChartConfig} className="aspect-auto h-full w-full">
                <RadarChart data={radarData}>
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <PolarAngleAxis
                    dataKey="pillar"
                    tick={({ x, y, payload, textAnchor, ...rest }) => {
                      const row = radarData.find((d) => d.pillar === payload.value);
                      const color = row ? pillarChartConfig[row.slug]?.color : undefined;
                      return (
                        <text
                          {...rest}
                          x={x}
                          y={y}
                          textAnchor={textAnchor}
                          fontSize={12}
                          fill={(color as string) ?? "var(--muted)"}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <PolarGrid radialLines={false} />
                  <Radar
                    dataKey="minutes"
                    name="Minutes"
                    fill="var(--primary)"
                    fillOpacity={0.25}
                    stroke="var(--primary)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ChartContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
