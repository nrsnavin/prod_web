import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { applyTheme, resolveTheme, useThemeEffect } from "./theme";
import { useUiStore } from "./uiStore";

type Listener = (e: { matches: boolean }) => void;

/**
 * jsdom ships no matchMedia, so every test that cares about the "system"
 * preference installs this fake. `emit` simulates the OS theme flipping
 * while the app is open.
 */
function installMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => mql),
  });
  return {
    emit(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  document.head.innerHTML = '<meta name="theme-color" content="#F8F8F8" />';
  useUiStore.setState({ theme: "system" });
});

afterEach(() => {
  // @ts-expect-error — removing the stub between tests
  delete window.matchMedia;
});

describe("resolveTheme", () => {
  it("honours an explicitly pinned theme regardless of the OS setting", () => {
    installMatchMedia(true);
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("follows the OS setting when set to system", () => {
    installMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    installMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("falls back to light where matchMedia is unavailable", () => {
    // Old browsers and jsdom — must not throw.
    expect(resolveTheme("system")).toBe("light");
  });
});

describe("applyTheme", () => {
  it("toggles the dark class that drives every CSS variable", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("keeps the browser chrome colour in step", () => {
    const meta = () =>
      document.querySelector('meta[name="theme-color"]')!.getAttribute("content");
    applyTheme("dark");
    expect(meta()).toBe("#131316");
    applyTheme("light");
    expect(meta()).toBe("#F8F8F8");
  });
});

describe("useThemeEffect", () => {
  it("applies the stored preference on mount", () => {
    installMatchMedia(false);
    useUiStore.setState({ theme: "dark" });
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("follows the OS live while the preference is system", () => {
    const mm = installMatchMedia(false);
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => mm.emit(true));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores OS changes once a theme is pinned", () => {
    const mm = installMatchMedia(false);
    useUiStore.setState({ theme: "light" });
    renderHook(() => useThemeEffect());

    act(() => mm.emit(true));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("stops listening to the OS after unmount", () => {
    const mm = installMatchMedia(false);
    const { unmount } = renderHook(() => useThemeEffect());
    expect(mm.listenerCount).toBe(1);
    unmount();
    expect(mm.listenerCount).toBe(0);
  });

  it("reacts to the preference changing at runtime", () => {
    installMatchMedia(false);
    renderHook(() => useThemeEffect());
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => useUiStore.getState().setTheme("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
