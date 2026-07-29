import { useEffect } from "react";
import { useUiStore, ThemeMode } from "./uiStore";

/** Colours the browser chrome (mobile address bar) to match the app. */
const THEME_COLOR = { light: "#F8F8F8", dark: "#131316" } as const;

const prefersDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** The theme actually rendered — resolves "system" against the OS setting. */
export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

/**
 * Applies a resolved theme to the document. Everything downstream keys off
 * the single `.dark` class on <html>, which flips the CSS variables in
 * index.css. Mirrors the pre-paint script in index.html.
 */
export function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolved]);
}

/**
 * Keeps <html> in sync with the stored preference. Mounted once at the app
 * root. While the preference is "system" it also follows the OS switching
 * theme underneath us — without a reload.
 */
export function useThemeEffect() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    applyTheme(resolveTheme(theme));

    if (theme !== "system") return;
    if (typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      applyTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}

/** Read the current preference and change it. */
export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  return { theme, setTheme, resolved: resolveTheme(theme) };
}
