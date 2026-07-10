import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { ArchivedTask, PillarRollup, Task, TimeBlock } from "../api/types";

export const samplePillars: PillarRollup[] = [
  {
    id: 4, slug: "skills", name: "Skills", description: null,
    color: "#0984E3", sort_order: 3, created_at: "2026-06-20T00:00:00+00:00",
    open_tasks: 2, minutes_this_week: 40,
  },
];

export const sampleTasks: Task[] = [
  {
    id: 1, pillar_id: 4, milestone_id: null, title: "write tests", description: null,
    status: "todo", is_impact: 1, is_effort: 0,
    due_date: null, note_ref: null, sort_order: 0,
    created_at: "2026-06-20T00:00:00+00:00", completed_at: null,
  },
];

export const sampleBlock: TimeBlock = {
  id: 7,
  task_id: 1,
  start_at: "2026-06-19T07:00:00+00:00",
  end_at: "2026-06-19T08:00:00+00:00",
  status: "done",
  auto_logged: 1,
  confirmed: 0,
  calendar_provider: null,
  calendar_event_id: null,
  created_at: "2026-06-19T06:00:00+00:00",
};

export const sampleArchivedTasks: ArchivedTask[] = [
  {
    id: 5,
    pillar_id: 4,
    pillar_slug: "skills",
    pillar_name: "Skills",
    pillar_color: "#0984E3",
    milestone_id: 2,
    milestone_title: "Ship dashboard",
    title: "archive finished work",
    description: "Build an archive table",
    status: "done",
    is_impact: 1,
    is_effort: 0,
    actual_duration_min: 75,
    due_date: "2026-06-22",
    note_ref: null,
    sort_order: 0,
    created_at: "2026-06-20T00:00:00+00:00",
    completed_at: "2026-06-22T10:00:00+00:00",
  },
  {
    id: 6,
    pillar_id: 4,
    pillar_slug: "skills",
    pillar_name: "Skills",
    pillar_color: "#0984E3",
    milestone_id: null,
    milestone_title: null,
    title: "short cleanup",
    description: null,
    status: "done",
    is_impact: 0,
    is_effort: 0,
    actual_duration_min: 15,
    due_date: null,
    note_ref: "notes/cleanup.md",
    sort_order: 1,
    created_at: "2026-06-20T00:00:00+00:00",
    completed_at: "2026-06-21T10:00:00+00:00",
  },
];

// Captures requests so tests can assert what the client sent.
export const captured: { url: string; method: string; body: unknown }[] = [];

async function record(request: Request) {
  let body: unknown = null;
  try { body = await request.clone().json(); } catch { /* no body */ }
  captured.push({ url: new URL(request.url).pathname, method: request.method, body });
}

export const handlers = [
  http.get("/api/pillars", () => HttpResponse.json(samplePillars)),
  http.post("/api/tasks/:id/status", async ({ request }) => {
    await record(request);
    return HttpResponse.json({ ...sampleTasks[0], status: "doing" });
  }),
  http.patch("/api/tasks/:id", async ({ request }) => {
    await record(request);
    return HttpResponse.json(sampleTasks[0]);
  }),
  http.post("/api/sessions", async ({ request }) => {
    await record(request);
    return HttpResponse.json({ id: 1 });
  }),
  http.get("/api/tasks", () => HttpResponse.json(sampleTasks)),
  http.get("/api/archive/tasks", () => HttpResponse.json(sampleArchivedTasks)),
  http.get("/api/tasks/:id", () => HttpResponse.json({ ...sampleTasks[0], subtasks: [], sessions_total_min: 0, blocks: [] })),
  http.get("/api/time_blocks", () => HttpResponse.json([])),
  http.patch("/api/time_blocks/:id", async ({ request, params }) => {
    await record(request);
    return HttpResponse.json({
      ...sampleBlock,
      id: Number(params.id),
      ...(await request.clone().json() as Record<string, unknown>),
    });
  }),
  http.get("/api/external_events", () => HttpResponse.json([])),
  http.get("/api/calendar/status", () =>
    HttpResponse.json({ enabled: false, accounts: [] })
  ),
  http.get("/api/impact-effort", () =>
    HttpResponse.json({
      high_impact_low_effort: sampleTasks,
      high_impact_high_effort: [],
      low_impact_low_effort: [],
      low_impact_high_effort: [],
    })
  ),
];

export const server = setupServer(...handlers);
