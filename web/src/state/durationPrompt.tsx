import { createContext, useContext, useState, type ReactNode } from "react";

interface PendingTask {
  id: number;
  title: string;
}

interface DurationPromptContextValue {
  pending: PendingTask | null;
  requestDuration: (task: PendingTask) => void;
  clearDuration: () => void;
}

const DurationPromptContext = createContext<DurationPromptContextValue | null>(null);

export function DurationPromptProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingTask | null>(null);

  return (
    <DurationPromptContext.Provider
      value={{
        pending,
        requestDuration: setPending,
        clearDuration: () => setPending(null),
      }}
    >
      {children}
    </DurationPromptContext.Provider>
  );
}

export function useDurationPrompt() {
  const ctx = useContext(DurationPromptContext);
  if (!ctx) throw new Error("useDurationPrompt must be used within DurationPromptProvider");
  return ctx;
}
