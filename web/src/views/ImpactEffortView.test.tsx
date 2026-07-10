import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../test/utils";
import { ImpactEffortView } from "./ImpactEffortView";

describe("ImpactEffortView", () => {
  it("renders the four impact/effort quadrants and seeded task", async () => {
    renderWithProviders(<ImpactEffortView />);
    expect(await screen.findByText("Quick Wins")).toBeInTheDocument();
    expect(screen.getByText("Major Projects")).toBeInTheDocument();
    expect(screen.getByText("Fill-ins")).toBeInTheDocument();
    expect(screen.getByText("Thankless")).toBeInTheDocument();
    expect(screen.getByText("write tests")).toBeInTheDocument();
  });
});
