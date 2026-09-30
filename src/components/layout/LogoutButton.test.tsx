import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LogoutButton } from "./LogoutButton";

const navigate = vi.fn();
const logout = vi.fn(async () => {});
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ logout }) }));

beforeEach(() => { navigate.mockClear(); logout.mockClear(); });

describe("LogoutButton", () => {
  it("asks first, and a cancel leaves the session alone", async () => {
    render(<MemoryRouter><LogoutButton /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(screen.getByText("Log out?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(logout).not.toHaveBeenCalled();
  });

  it("logs out and goes to the login screen on confirm", async () => {
    render(<MemoryRouter><LogoutButton iconOnly /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    const buttons = screen.getAllByRole("button", { name: "Log out" });
    await userEvent.click(buttons[buttons.length - 1]); // the dialog's
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
