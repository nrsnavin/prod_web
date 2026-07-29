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

  // ── Per-user sidebar customization (persisted in this browser) ──
  // navHidden: item paths the user chose to hide from the sidebar
  // (cosmetic only — the route stays reachable by URL).
  // navOrder: sectionLabel → ordered array of item paths.
  navHidden: string[];
  navOrder: Record<string, string[]>;
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

      navHidden: [],
      navOrder: {},
      toggleNavHidden: (path) =>
        set((s) => ({
          navHidden: s.navHidden.includes(path)
            ? s.navHidden.filter((p) => p !== path)
            : [...s.navHidden, path],
        })),
      setSectionOrder: (sectionLabel, paths) =>
        set((s) => ({ navOrder: { ...s.navOrder, [sectionLabel]: paths } })),
      resetNavPrefs: () => set({ navHidden: [], navOrder: {} }),
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
