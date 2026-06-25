import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { ArchiveView } from "./ArchiveView";

describe("ArchiveView", () => {
  it("renders completed tasks with actual duration", async () => {
    renderWithProviders(<ArchiveView />);

    expect(await screen.findByText("archive finished work")).toBeInTheDocument();
    expect(screen.getByText("short cleanup")).toBeInTheDocument();
    expect(screen.getByText("1h 15m")).toBeInTheDocument();
    expect(screen.getByText("15m")).toBeInTheDocument();
    expect(screen.getByText("2 done")).toBeInTheDocument();
  });

  it("filters by search text and minimum duration", async () => {
    renderWithProviders(<ArchiveView />);

    const search = await screen.findByPlaceholderText("Task, note, pillar...");
    await userEvent.type(search, "cleanup");
    expect(screen.queryByText("archive finished work")).not.toBeInTheDocument();
    expect(screen.getByText("short cleanup")).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(screen.getByLabelText("Min min"), "60");

    await waitFor(() => {
      expect(screen.getByText("archive finished work")).toBeInTheDocument();
      expect(screen.queryByText("short cleanup")).not.toBeInTheDocument();
    });
  });
});
