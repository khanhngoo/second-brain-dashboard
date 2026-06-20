import { usePillars } from "../hooks/queries";
import { ALL, usePillarFilter } from "../state/pillarFilter";

export function PillarSwitcher() {
  const { data: pillars } = usePillars();
  const { pillar, setPillar } = usePillarFilter();

  return (
    <div className="pillar-switcher">
      <button
        className={pillar === ALL ? "pill active" : "pill"}
        onClick={() => setPillar(ALL)}
      >
        All
      </button>
      {pillars?.map((p) => (
        <button
          key={p.slug}
          className={pillar === p.slug ? "pill active" : "pill"}
          style={{ borderColor: p.color ?? undefined }}
          onClick={() => setPillar(p.slug)}
        >
          <span className="dot" style={{ background: p.color ?? "#888" }} />
          {p.name}
        </button>
      ))}
    </div>
  );
}
