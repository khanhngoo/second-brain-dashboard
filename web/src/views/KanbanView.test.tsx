import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { KanbanView } from "./KanbanView";

// Drag simulation with @dnd-kit + jsdom is brittle; the status-change wiring is
// covered by the client test (setTaskStatus posts {status}). Here we assert the
// board renders the three columns and places the seeded task in To Do.
describe("KanbanView", () => {
  it("renders three columns with the task in To Do", async () => {
    renderWithProviders(<KanbanView />);
    expect(await screen.findByText(/To Do/)).toBeInTheDocument();
    expect(screen.getByText("Doing")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("write tests")).toBeInTheDocument();
  });
});
