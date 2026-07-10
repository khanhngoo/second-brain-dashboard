import { createContext, useContext, useState, type ReactNode } from "react";
import type { TimeBlock } from "../api/types";

export interface BlockDraft {
  block: TimeBlock;
  title?: string;
}

interface BlockDrawerContextValue {
  isOpen: boolean;
  draft: BlockDraft | null;
  openBlockDrawer: (draft: BlockDraft) => void;
  closeBlockDrawer: () => void;
}

const BlockDrawerContext = createContext<BlockDrawerContextValue | null>(null);

export function BlockDrawerProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);

  function openBlockDrawer(nextDraft: BlockDraft) {
    setDraft(nextDraft);
  }

  function closeBlockDrawer() {
    setDraft(null);
  }

  return (
    <BlockDrawerContext.Provider value={{ isOpen: draft != null, draft, openBlockDrawer, closeBlockDrawer }}>
      {children}
    </BlockDrawerContext.Provider>
  );
}

export function useBlockDrawer() {
  const ctx = useContext(BlockDrawerContext);
  if (!ctx) throw new Error("useBlockDrawer must be used within BlockDrawerProvider");
  return ctx;
}
