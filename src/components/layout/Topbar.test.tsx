import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Topbar } from "./Topbar";

// ══════════════════════════════════════════════════════════════════
//  THE PROFILE ICON HAS TO GO SOMEWHERE
//
//  It sat in the topbar for every user, on every page, doing nothing
//  but showing an initial — the one piece of the UI that looked
//  clickable and wasn't.
// ══════════════════════════════════════════════════════════════════

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/core/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "Priya Sharma", role: "production" },
    logout: vi.fn(),
  }),
}));

const renderTopbar = () =>
  render(
    <MemoryRouter>
      <Topbar onMenuClick={vi.fn()} onSearchClick={vi.fn()} />
    </MemoryRouter>
  );

beforeEach(() => {
  navigate.mockClear();
});

describe("the profile icon", () => {
  it("opens the profile page on click", async () => {
    const user = userEvent.setup();
    renderTopbar();

    await user.click(screen.getByRole("button", { name: /view profile/i }));
    expect(navigate).toHaveBeenCalledWith("/profile");
  });

  it("still shows the signed-in user's name and role beside it", () => {
    renderTopbar();
    const trigger = screen.getByRole("button", { name: /view profile/i });
    expect(trigger).toHaveTextContent("Priya Sharma");
    expect(trigger).toHaveTextContent("production");
  });
});
