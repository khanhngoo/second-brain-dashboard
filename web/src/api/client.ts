// Typed API client — one function per FastAPI route. The frontend's ONLY door
// to the backend (docs/07): no SQL, no DB. Mirrors secondbrain/api/app.py.

import type {
  Bucket,
  CalendarStatus,
  Eisenhower,
  ExternalEvent,
  Kanban,
  Milestone,
  PillarRollup,
  PillarTimeRow,
  PillarWithMilestones,
  Task,
  TaskDetail,
  TimeBlock,
  TodayBrief,
} from "./types";

const BASE = "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// --- Reads ----------------------------------------------------------------

export const getTodayBrief = (date?: string) =>
  request<TodayBrief>(`/today_brief${qs({ date })}`);

export const getPillars = () => request<PillarRollup[]>("/pillars");

export const getPillar = (slug: string) =>
  request<PillarWithMilestones>(`/pillars/${slug}`);

export const listMilestones = (pillar?: string, status?: string) =>
  request<Milestone[]>(`/milestones${qs({ pillar, status })}`);

export const listTasks = (params: {
  pillar?: string;
  milestone?: number;
  status?: string;
  quadrant?: string;
  due_before?: string;
  limit?: number;
} = {}) => request<Task[]>(`/tasks${qs(params)}`);

export const getTask = (id: number) => request<TaskDetail>(`/tasks/${id}`);

export const getKanban = (pillar?: string) =>
  request<Kanban>(`/kanban${qs({ pillar })}`);

export const getEisenhower = (pillar?: string) =>
  request<Eisenhower>(`/eisenhower${qs({ pillar })}`);

export const getPillarTime = (bucket: Bucket, start?: string, end?: string) =>
  request<PillarTimeRow[]>(`/pillar_time${qs({ bucket, start, end })}`);

// P2 range reads
export const listExternalEvents = (start: string, end: string) =>
  request<ExternalEvent[]>(`/external_events${qs({ start, end })}`);

export const listTimeBlocks = (start: string, end: string) =>
  request<TimeBlock[]>(`/time_blocks${qs({ start, end })}`);

// --- Writes ---------------------------------------------------------------

export const createTask = (body: {
  pillar: string | number;
  title: string;
  milestone?: number;
  description?: string;
  is_urgent?: boolean;
  is_important?: boolean;
  estimated_duration_min?: number;
  timer_mode?: string;
  due_date?: string;
  note_ref?: string;
}) => request<Task>("/tasks", { method: "POST", body: JSON.stringify(body) });

// PATCH routes take {"fields": {...}} (UpdateFieldsBody) — wrap here, always.
export const updateTask = (id: number, fields: Partial<Task>) =>
  request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ fields }) });

export const setTaskStatus = (id: number, status: string) =>
  request<Task>(`/tasks/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });

export const createMilestone = (body: {
  pillar: string | number;
  title: string;
  description?: string;
  target_date?: string;
}) => request<Milestone>("/milestones", { method: "POST", body: JSON.stringify(body) });

export const updateMilestone = (id: number, fields: Partial<Milestone>) =>
  request<Milestone>(`/milestones/${id}`, { method: "PATCH", body: JSON.stringify({ fields }) });

export const addSubtask = (taskId: number, title: string) =>
  request(`/tasks/${taskId}/subtasks`, { method: "POST", body: JSON.stringify({ title }) });

export const toggleSubtask = (id: number) =>
  request(`/subtasks/${id}/toggle`, { method: "POST" });

export const logSession = (body: {
  task_id: number;
  duration_min: number;
  source?: string;
  started_at?: string;
  ended_at?: string;
  note?: string;
}) => request("/sessions", { method: "POST", body: JSON.stringify(body) });

export const startTimer = (task_id: number, mode?: string) =>
  request("/timers/start", { method: "POST", body: JSON.stringify({ task_id, mode }) });

export const stopTimer = (task_id: number, mark_done = false) =>
  request("/timers/stop", { method: "POST", body: JSON.stringify({ task_id, mark_done }) });

export const createTimeBlock = (task_id: number, start_at: string, end_at: string) =>
  request<TimeBlock>("/time_blocks", {
    method: "POST",
    body: JSON.stringify({ task_id, start_at, end_at }),
  });

export const moveTimeBlock = (id: number, start_at: string, end_at: string) =>
  request<TimeBlock>(`/time_blocks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ start_at, end_at }),
  });

export const deleteTimeBlock = (id: number) =>
  request(`/time_blocks/${id}`, { method: "DELETE" });

export const confirmBlocks = (date: string) =>
  request("/blocks/confirm", { method: "POST", body: JSON.stringify({ date }) });

export const markBlockSkipped = (id: number) =>
  request<TimeBlock>(`/time_blocks/${id}/skip`, { method: "POST" });

// P3 — calendar
export const getCalendarStatus = () => request<CalendarStatus>("/calendar/status");
export const syncCalendar = () => request("/calendar/sync", { method: "POST" });
export const connectCalendar = () => request("/calendar/connect", { method: "POST" });
