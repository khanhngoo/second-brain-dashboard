import { usePillars } from "../hooks/queries";

/** Look up a pillar's color/name by id. Cheap — pillars are cached. */
export function usePillarLookup() {
  const { data } = usePillars();
  return (pillarId: number) => data?.find((p) => p.id === pillarId);
}

export function PillarBadge({ pillarId }: { pillarId: number }) {
  const lookup = usePillarLookup();
  const p = lookup(pillarId);
  return (
    <span className="pillar-badge" style={{ background: p?.color ?? "#888" }} title={p?.name}>
      {p?.name ?? "?"}
    </span>
  );
}
