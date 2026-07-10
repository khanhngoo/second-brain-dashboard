// Pillar filter — a multi-select set of pillar slugs. Empty set = "all".
// Filtering is client-side (the matrix fetches every task, then narrows the
// cards), so apiPillar stays undefined and the backend always returns all.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const ALL = "all" as const;

interface Ctx {
  /** Selected pillar slugs. Empty = no filter (show all). */
  selected: Set<string>;
  toggle: (slug: string) => void;
  clear: () => void;
  isActive: (slug: string) => boolean;
  /** True when a given pillar_id passes the current filter. */
  matches: (slug: string | undefined) => boolean;
  /** Always undefined — filtering is client-side, backend returns all. */
  apiPillar: undefined;
}

const PillarFilterContext = createContext<Ctx | null>(null);

export function PillarFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const value = useMemo<Ctx>(() => {
    const toggle = (slug: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        return next;
      });
    return {
      selected,
      toggle,
      clear: () => setSelected(new Set()),
      isActive: (slug: string) => selected.has(slug),
      matches: (slug: string | undefined) =>
        selected.size === 0 || (slug != null && selected.has(slug)),
      apiPillar: undefined,
    };
  }, [selected]);

  return (
    <PillarFilterContext.Provider value={value}>{children}</PillarFilterContext.Provider>
  );
}

export function usePillarFilter(): Ctx {
  const ctx = useContext(PillarFilterContext);
  if (!ctx) throw new Error("usePillarFilter must be used within PillarFilterProvider");
  return ctx;
}
