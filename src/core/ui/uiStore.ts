import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentItem {
  path: string;
  label: string;
  type: string; // "Job" | "Order" | "Customer" | …
  at: number;
}

/** "system" follows the OS setting live; the other two pin the theme. */
export type ThemeMode = "light" | "dark" | "system";

/**
 * Table row height. Compact fits more rows on a desk; comfortable is
 * roomier. A touch screen always gets comfortable rows (see index.css),
 * because there a row is something a finger has to hit.
 */
export type Density = "compact" | "comfortable";

/**
 * localStorage key this store persists under. index.html reads the same key
 * in a pre-paint script to apply the theme before React mounts, so keep the
 * two in sync if it ever changes.
 */
export const UI_STORAGE_KEY = "jarvis-ui";

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
  recent: RecentItem[];
  addRecent(item: Omit<RecentItem, "at">): void;

  theme: ThemeMode;
  setTheme(theme: ThemeMode): void;

  density: Density;
  setDensity(density: Density): void;

  // ── Per-user sidebar customization (persisted in this browser) ──
  // navHidden: item paths the user chose to hide from the sidebar
  // (cosmetic only — the route stays reachable by URL).
  // navOrder: sectionLabel → ordered array of item paths.
  navHidden: string[];
  navOrder: Record<string, string[]>;
  /** Entries pinned to the top of the menu, in the order they were pinned. */
  navPinned: string[];
  togglePinned(path: string): void;
  toggleNavHidden(path: string): void;
  setSectionOrder(sectionLabel: string, paths: string[]): void;
  resetNavPrefs(): void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      recent: [],
      addRecent: (item) =>
        set((s) => ({
          recent: [
            { ...item, at: Date.now() },
            ...s.recent.filter((r) => r.path !== item.path),
          ].slice(0, 8),
        })),

      theme: "system",
      setTheme: (theme) => set({ theme }),

      density: "compact",
      setDensity: (density) => set({ density }),

      navHidden: [],
      navOrder: {},
      navPinned: [],
      togglePinned: (path) =>
        set((s) => ({
          navPinned: s.navPinned.includes(path) ? s.navPinned.filter((p) => p !== path) : [...s.navPinned, path],
        })),
      toggleNavHidden: (path) =>
        set((s) => ({
          navHidden: s.navHidden.includes(path)
            ? s.navHidden.filter((p) => p !== path)
            : [...s.navHidden, path],
        })),
      setSectionOrder: (sectionLabel, paths) =>
        set((s) => ({ navOrder: { ...s.navOrder, [sectionLabel]: paths } })),
      resetNavPrefs: () => set({ navHidden: [], navOrder: {}, navPinned: [] }),
    }),
    { name: UI_STORAGE_KEY }
  )
);

// Call from a detail page once its entity is loaded; records it in the
// dashboard's "recently viewed" row. Safe before early returns — skips
// until label is known.
import { useEffect } from "react";
export function useTrackRecent(type: string, path: string, label?: string) {
  const addRecent = useUiStore((s) => s.addRecent);
  useEffect(() => {
    if (label) addRecent({ type, path, label });
  }, [type, path, label, addRecent]);
}
