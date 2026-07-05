import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format } from "date-fns";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CalendarView } from "./CalendarView";
import { captured, sampleTasks, server } from "../test/server";
import { renderWithProviders } from "../test/utils";

describe("CalendarView", () => {
  it("renders the agenda/list toolbar option", async () => {
    renderWithProviders(<CalendarView />);

    expect(await screen.findByRole("button", { name: /list/i })).toBeInTheDocument();
  });

  it("marks a calendar block's task done from the block icon", async () => {
    server.use(
      http.get("/api/time_blocks", () =>
        HttpResponse.json([
          {
            id: 12,
            task_id: 1,
            // Dates must fall in the currently visible listWeek range, so use today.
            start_at: `${format(new Date(), "yyyy-MM-dd")}T09:00:00`,
            end_at: `${format(new Date(), "yyyy-MM-dd")}T10:00:00`,
            status: "planned",
            auto_logged: 0,
            confirmed: 0,
            calendar_provider: null,
            calendar_event_id: null,
            created_at: `${format(new Date(), "yyyy-MM-dd")}T08:00:00`,
          },
        ]),
      ),
      http.get("/api/tasks", () => HttpResponse.json(sampleTasks)),
    );

    renderWithProviders(<CalendarView />);

    await userEvent.click(await screen.findByRole("button", { name: /list/i }));
    await userEvent.click(await screen.findByRole("button", { name: /mark write tests done/i }));

    await waitFor(() =>
      expect(captured.find((call) => call.url === "/api/tasks/1/status")?.body).toEqual({ status: "done" }),
    );
  });
});
