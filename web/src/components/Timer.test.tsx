import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { captured } from "../test/server";
import { Timer } from "./Timer";
import type { Task } from "../api/types";

const baseTask: Task = {
  id: 1, pillar_id: 4, milestone_id: null, title: "t", description: null,
  status: "todo", is_urgent: 0, is_important: 0, estimated_duration_min: 1,
  timer_mode: "manual", due_date: null, note_ref: null, sort_order: 0,
  created_at: "2026-06-20T00:00:00+00:00", completed_at: null,
};

// fireEvent (synchronous) + real timers advanced via a stubbed Date isn't worth
// the complexity; instead we stub the interval by driving elapsed time through
// fake timers and flushing async fetches with waitFor (real msw resolution).
describe("Timer — the three session/status semantics (docs/04)", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("Manual Stop logs source=manual and does NOT touch status", async () => {
    renderWithProviders(<Timer task={baseTask} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.advanceTimersByTimeAsync(90_000);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(captured.find((c) => c.url === "/api/sessions")).toBeTruthy());
    const session = captured.find((c) => c.url === "/api/sessions");
    expect((session!.body as { source: string }).source).toBe("manual");
    expect(captured.find((c) => c.url.endsWith("/status"))).toBeUndefined();
  });

  it("Manual Done logs THEN sets status done (two writes, in order)", async () => {
    renderWithProviders(<Timer task={baseTask} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.advanceTimersByTimeAsync(30_000);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(captured.find((c) => c.url === "/api/tasks/1/status")).toBeTruthy());
    const sessionIdx = captured.findIndex((c) => c.url === "/api/sessions");
    const statusIdx = captured.findIndex((c) => c.url === "/api/tasks/1/status");
    expect(sessionIdx).toBeGreaterThanOrEqual(0);
    expect(statusIdx).toBeGreaterThan(sessionIdx);
    expect((captured[statusIdx].body as { status: string }).status).toBe("done");
  });

  it("Pomodoro auto-logs the FULL box (source=pomodoro) at zero, no status", async () => {
    const pomo: Task = { ...baseTask, timer_mode: "pomodoro", estimated_duration_min: 1 };
    renderWithProviders(<Timer task={pomo} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.advanceTimersByTimeAsync(61_000);
    await waitFor(() => expect(captured.find((c) => c.url === "/api/sessions")).toBeTruthy());
    const body = captured.find((c) => c.url === "/api/sessions")!.body as {
      source: string;
      duration_min: number;
    };
    expect(body.source).toBe("pomodoro");
    expect(body.duration_min).toBe(1);
    expect(captured.find((c) => c.url.endsWith("/status"))).toBeUndefined();
  });
});
