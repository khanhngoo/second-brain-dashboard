// The pillar switcher filters Eisenhower / Calendar / Analytics / Milestones
// to one pillar slug or "all".

import { createContext, useContext, useState, type ReactNode } from "react";

export const ALL = "all" as const;
export type PillarFilter = string; // a pillar slug or ALL

interface Ctx {
  pillar: PillarFilter;
  setPillar: (p: PillarFilter) => void;
  /** slug for API calls, or undefined when "all". */
  apiPillar: string | undefined;
}

const PillarFilterContext = createContext<Ctx | null>(null);

export function PillarFilterProvider({ children }: { children: ReactNode }) {
  const [pillar, setPillar] = useState<PillarFilter>(ALL);
  const apiPillar = pillar === ALL ? undefined : pillar;
  return (
    <PillarFilterContext.Provider value={{ pillar, setPillar, apiPillar }}>
      {children}
    </PillarFilterContext.Provider>
  );
}

export function usePillarFilter(): Ctx {
  const ctx = useContext(PillarFilterContext);
  if (!ctx) throw new Error("usePillarFilter must be used within PillarFilterProvider");
  return ctx;
}
