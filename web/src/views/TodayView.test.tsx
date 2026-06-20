import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/utils";
import { captured } from "../test/server";
import { TodayView } from "./TodayView";

describe("TodayView", () => {
  it("renders the week pillar strip and the unconfirmed block", async () => {
    renderWithProviders(<TodayView />);
    expect(await screen.findByText(/Today — 2026-06-20/)).toBeInTheDocument();
    expect(screen.getByText("Cracked Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Block #7/)).toBeInTheDocument();
  });

  it("Confirm fires POST /blocks/confirm with the block's date", async () => {
    renderWithProviders(<TodayView />);
    const btn = await screen.findByRole("button", { name: "Confirm" });
    await userEvent.click(btn);
    await waitFor(() => {
      const call = captured.find((c) => c.url === "/api/blocks/confirm");
      expect(call?.body).toEqual({ date: "2026-06-19" });
    });
  });

  it("Skip fires POST /time_blocks/{id}/skip with the right id", async () => {
    renderWithProviders(<TodayView />);
    const btn = await screen.findByRole("button", { name: "Skip" });
    await userEvent.click(btn);
    await waitFor(() => {
      const call = captured.find((c) => c.url === "/api/time_blocks/7/skip");
      expect(call).toBeTruthy();
    });
  });
});
