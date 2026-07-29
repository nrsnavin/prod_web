import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";
import { useUiStore } from "@/core/ui/uiStore";

beforeEach(() => {
  // jsdom has no matchMedia; without it "system" can't resolve.
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  });
  useUiStore.setState({ theme: "system" });
});

afterEach(() => {
  // @ts-expect-error — removing the stub between tests
  delete window.matchMedia;
});

describe("ThemeToggle", () => {
  it("names the current preference for screen readers", () => {
    useUiStore.setState({ theme: "dark" });
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /currently dark/i })).toBeInTheDocument();
  });

  it("offers all three preferences and marks the active one", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /change theme/i }));

    // The System row also renders the theme it currently resolves to, so its
    // accessible name is "System light" — hence the anchored matchers.
    expect(screen.getByRole("menuitemradio", { name: /^Light$/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("menuitemradio", { name: /^System/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("stores the picked theme and closes the menu", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /change theme/i }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /dark/i }));

    expect(useUiStore.getState().theme).toBe("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("dismisses on Escape without changing the theme", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: /change theme/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(useUiStore.getState().theme).toBe("system");
  });
});
