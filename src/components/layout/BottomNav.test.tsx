import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BottomNav, tabsFor } from "./BottomNav";

let user: Record<string, unknown> | null = null;
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user }) }));

const paths = (u: Record<string, unknown>) => tabsFor(u).map((t) => t.path);

describe("tabsFor", () => {
  it("gives each department its everyday screens, Home first", () => {
    expect(paths({ role: "admin", department: "admin" })).toEqual(["/", "/orders", "/jobs", "/machines"]);
    expect(paths({ role: "production", department: "production" })).toEqual(["/", "/jobs", "/machines", "/shift-plans"]);
    expect(paths({ role: "production", department: "packing" })).toEqual(["/", "/packing", "/qc", "/jobs"]);
    expect(paths({ role: "accounts", department: "finance" })).toEqual(["/", "/orders", "/customers", "/materials"]);
  });

  it("never offers a screen the user may not open", () => {
    // A per-user feature list narrower than the department's defaults.
    const tabs = paths({ role: "production", department: "production", features: ["/", "/jobs", "/machine-issues"] });
    expect(tabs).not.toContain("/machines");
    expect(tabs).not.toContain("/shift-plans");
    expect(tabs).toContain("/jobs");
  });

  it("fills from what is open to a user with no preference set", () => {
    const tabs = paths({ role: "user", department: null });
    expect(tabs[0]).toBe("/");
    expect(tabs.length).toBeGreaterThan(1);
    expect(tabs.length).toBeLessThanOrEqual(4);
  });
});

describe("BottomNav", () => {
  it("marks the current screen and opens the full menu from More", async () => {
    user = { role: "production", department: "production" };
    const onMore = vi.fn();
    render(
      <MemoryRouter initialEntries={["/jobs/123"]}>
        <BottomNav onMore={onMore} />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});
