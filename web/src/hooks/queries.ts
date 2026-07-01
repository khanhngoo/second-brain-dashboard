// TanStack Query hooks — one per shaped read route. Mutations invalidate the
// affected view's query key so "one route feeds one view" holds.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Bucket } from "../api/types";

export const keys = {
  brief: (date?: string) => ["today_brief", date ?? "today"] as const,
  pillars: () => ["pillars"] as const,
  pillar: (slug: string) => ["pillar", slug] as const,
  milestones: (pillar?: string) => ["milestones", pillar ?? "all"] as const,
  kanban: (pillar?: string) => ["kanban", pillar ?? "all"] as const,
  impactEffort: (pillar?: string) => ["impact_effort", pillar ?? "all"] as const,
  pillarTime: (bucket: Bucket) => ["pillar_time", bucket] as const,
  archivedTasks: (pillar?: string, completedFrom?: string, completedTo?: string) =>
    ["archived_tasks", pillar ?? "all", completedFrom ?? "", completedTo ?? ""] as const,
  task: (id: number) => ["task", id] as const,
  timeBlocks: (start: string, end: string) => ["time_blocks", start, end] as const,
  externalEvents: (start: string, end: string) => ["external_events", start, end] as const,
  calendarStatus: () => ["calendar_status"] as const,
};

export const useTodayBrief = (date?: string) =>
  useQuery({ queryKey: keys.brief(date), queryFn: () => api.getTodayBrief(date) });

export const usePillars = () =>
  useQuery({ queryKey: keys.pillars(), queryFn: api.getPillars });

export const usePillar = (slug: string) =>
  useQuery({ queryKey: keys.pillar(slug), queryFn: () => api.getPillar(slug) });

export const useMilestones = (pillar?: string) =>
  useQuery({ queryKey: keys.milestones(pillar), queryFn: () => api.listMilestones(pillar) });

export const useKanban = (pillar?: string) =>
  useQuery({ queryKey: keys.kanban(pillar), queryFn: () => api.getKanban(pillar) });

export const useImpactEffort = (pillar?: string) =>
  useQuery({ queryKey: keys.impactEffort(pillar), queryFn: () => api.getImpactEffort(pillar) });

export const usePillarTime = (bucket: Bucket) =>
  useQuery({ queryKey: keys.pillarTime(bucket), queryFn: () => api.getPillarTime(bucket) });

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

export function useConfirmBlocks() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (date: string) => api.confirmBlocks(date), onSuccess: invalidate });
}

export function useSkipBlock() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api.markBlockSkipped(id), onSuccess: invalidate });
}
