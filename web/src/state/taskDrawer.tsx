import { createContext, useContext, useState, type ReactNode } from "react";
import type { TimerMode } from "../api/types";

export interface TaskDraft {
  taskId?: number;
  pillar?: string | number;
  milestone?: number;
  title?: string;
  description?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  estimated_duration_min?: number;
  timer_mode?: TimerMode;
  due_date?: string;
  note_ref?: string;
}

interface TaskDrawerContextValue {
  isOpen: boolean;
  draft: TaskDraft;
  openTaskDrawer: (draft?: TaskDraft) => void;
  closeTaskDrawer: () => void;
}

const TaskDrawerContext = createContext<TaskDrawerContextValue | null>(null);

export function TaskDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>({});

  function openTaskDrawer(nextDraft: TaskDraft = {}) {
    setDraft(nextDraft);
    setIsOpen(true);
  }

  function closeTaskDrawer() {
    setIsOpen(false);
    setDraft({});
  }

  return (
    <TaskDrawerContext.Provider value={{ isOpen, draft, openTaskDrawer, closeTaskDrawer }}>
      {children}
    </TaskDrawerContext.Provider>
  );
}

export function useTaskDrawer() {
  const ctx = useContext(TaskDrawerContext);
  if (!ctx) throw new Error("useTaskDrawer must be used within TaskDrawerProvider");
  return ctx;
}
