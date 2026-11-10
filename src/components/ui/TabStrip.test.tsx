import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabStrip, fitCount, splitTabs } from "./TabStrip";

// One row of tabs: what fits, and the rest under More, with the open tab
// always in the row.

describe("what fits", () => {
  it("all of them, when they fit", () => {
    expect(fitCount([100, 100, 100], 60, 300)).toBe(3);
  });

  it("as many as fit beside More", () => {
    expect(fitCount([100, 100, 100, 100], 60, 300)).toBe(2);
  });

  it("at least one", () => {
    expect(fitCount([500, 100], 60, 200)).toBe(1);
  });
});

describe("splitting the row", () => {
  const tabs = ["a", "b", "c", "d", "e"];
  it("the first that fit, the rest under More", () => {
    expect(splitTabs(tabs, 3, 0)).toEqual({ row: ["a", "b", "c"], more: ["d", "e"] });
  });

  it("an open tab past the edge takes the last place in the row", () => {
    expect(splitTabs(tabs, 3, 4)).toEqual({ row: ["a", "b", "e"], more: ["c", "d"] });
  });
});

describe("the strip", () => {
  it("marks the open tab and goes to another", async () => {
    const onSelect = vi.fn();
    render(<TabStrip label="Books" tabs={[{ id: "a", label: "Banking" }, { id: "b", label: "Month end" }]} active="b" onSelect={onSelect} />);
    const nav = screen.getByRole("navigation", { name: "Books" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Month end" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Banking" }));
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
