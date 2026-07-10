// TanStack Query hooks — one per shaped read route. Mutations invalidate the
// affected view's query key so "one route feeds one view" holds.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Bucket, Task } from "../api/types";
import { useDurationPrompt } from "../state/durationPrompt";

export const keys = {
  pillars: () => ["pillars"] as const,
  pillar: (slug: string) => ["pillar", slug] as const,
  milestones: () => ["milestones"] as const,
  impactEffort: (pillar?: string) => ["impact_effort", pillar ?? "all"] as const,
  pillarTime: (bucket: Bucket, start?: string, end?: string) =>
    ["pillar_time", bucket, start ?? "", end ?? ""] as const,
  archivedTasks: (pillar?: string, completedFrom?: string, completedTo?: string) =>
    ["archived_tasks", pillar ?? "all", completedFrom ?? "", completedTo ?? ""] as const,
  task: (id: number) => ["task", id] as const,
  timeBlocks: (start: string, end: string) => ["time_blocks", start, end] as const,
  externalEvents: (start: string, end: string) => ["external_events", start, end] as const,
  calendarStatus: () => ["calendar_status"] as const,
};

export const usePillars = () =>
  useQuery({ queryKey: keys.pillars(), queryFn: api.getPillars });

export const usePillar = (slug: string) =>
  useQuery({ queryKey: keys.pillar(slug), queryFn: () => api.getPillar(slug) });

export const useMilestones = () =>
  useQuery({ queryKey: keys.milestones(), queryFn: () => api.listMilestones() });

export const useImpactEffort = (pillar?: string) =>
  useQuery({ queryKey: keys.impactEffort(pillar), queryFn: () => api.getImpactEffort(pillar) });

export const usePillarTime = (bucket: Bucket, start?: string, end?: string) =>
  useQuery({
    queryKey: keys.pillarTime(bucket, start, end),
    queryFn: () => api.getPillarTime(bucket, start, end),
  });

export const useArchivedTasks = (params: {
  pillar?: string;
  completed_from?: string;
  completed_to?: string;
} = {}) =>
  useQuery({
    queryKey: keys.archivedTasks(params.pillar, params.completed_from, params.completed_to),
    queryFn: () => api.listArchivedTasks(params),
  });

export const useTask = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.task(id), queryFn: () => api.getTask(id), enabled });

export function useInvalidateAll() {
  const qc = useQueryClient();
  // Broad invalidation after a write — simple and correct for a single-user app.
  return () => qc.invalidateQueries();
}

export function useSetTaskStatus() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.setTaskStatus(id, status),
    onSuccess: invalidate,
  });
}

// Wraps useSetTaskStatus for the "mark done" transition specifically: fires
// the status change as normal, then — if the task has nothing logged yet —
// opens the duration-prompt dialog as a non-blocking follow-up nudge so
// finished work doesn't silently end up with a 0-minute total.
export function useMarkTaskDone() {
  const setStatus = useSetTaskStatus();
  const { requestDuration } = useDurationPrompt();
  return (task: Task) => {
    setStatus.mutate({ id: task.id, status: "done" });
    if (!task.actual_duration_min) {
      requestDuration({ id: task.id, title: task.title });
    }
  };
}

// Sweep every done task in the matrix into the archive. Client-side loop over
// the impact/effort buckets (no dedicated endpoint) → status `archived`.
export function useArchiveDone() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await api.setTaskStatus(id, "archived");
    },
    onSuccess: invalidate,
  });
}

