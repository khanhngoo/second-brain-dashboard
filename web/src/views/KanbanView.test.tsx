import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { EisenhowerView } from "./EisenhowerView";

describe("EisenhowerView", () => {
  it("renders the four decision quadrants and seeded task", async () => {
    renderWithProviders(<EisenhowerView />);
    expect(await screen.findByText("Do now")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Minimize")).toBeInTheDocument();
    expect(screen.getByText("Drop later")).toBeInTheDocument();
    expect(screen.getByText("write tests")).toBeInTheDocument();
  });
});
