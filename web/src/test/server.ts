import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { TodayBrief, Kanban, PillarRollup } from "../api/types";

export const sampleBrief: TodayBrief = {
  date: "2026-06-20",
  blocks: [],
  external_events: [],
  due_today: [],
  overdue: [],
  in_progress: [],
  unconfirmed_blocks: [
    {
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
    },
  ],
  week_pillar_minutes: [
    { pillar_id: 4, slug: "cracked_engineer", name: "Cracked Engineer", minutes: 40 },
  ],
};

export const samplePillars: PillarRollup[] = [
  {
    id: 4, slug: "cracked_engineer", name: "Cracked Engineer", description: null,
    color: "#0984E3", sort_order: 3, created_at: "2026-06-20T00:00:00+00:00",
    active_milestones: 1, open_tasks: 2, minutes_this_week: 40,
  },
];

export const sampleKanban: Kanban = {
  todo: [{
    id: 1, pillar_id: 4, milestone_id: null, title: "write tests", description: null,
    status: "todo", is_urgent: 0, is_important: 1, estimated_duration_min: 30,
    timer_mode: null, due_date: null, note_ref: null, sort_order: 0,
    created_at: "2026-06-20T00:00:00+00:00", completed_at: null,
  }],
  doing: [],
  done: [],
};

// Captures requests so tests can assert what the client sent.
export const captured: { url: string; method: string; body: unknown }[] = [];

async function record(request: Request) {
  let body: unknown = null;
  try { body = await request.clone().json(); } catch { /* no body */ }
  captured.push({ url: new URL(request.url).pathname, method: request.method, body });
}

export const handlers = [
  http.get("/api/today_brief", () => HttpResponse.json(sampleBrief)),
  http.get("/api/pillars", () => HttpResponse.json(samplePillars)),
  http.get("/api/kanban", () => HttpResponse.json(sampleKanban)),
  http.post("/api/blocks/confirm", async ({ request }) => {
    await record(request);
    return HttpResponse.json({ confirmed: 1, date: "2026-06-19" });
  }),
  http.post("/api/time_blocks/:id/skip", async ({ request }) => {
    await record(request);
    return HttpResponse.json({ ...sampleBrief.unconfirmed_blocks[0], status: "skipped" });
  }),
  http.post("/api/tasks/:id/status", async ({ request }) => {
    await record(request);
    return HttpResponse.json({ ...sampleKanban.todo[0], status: "doing" });
  }),
  http.patch("/api/tasks/:id", async ({ request }) => {
    await record(request);
    return HttpResponse.json(sampleKanban.todo[0]);
  }),
];

export const server = setupServer(...handlers);
