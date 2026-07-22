import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentItem {
  path: string;
  label: string;
  type: string; // "Job" | "Order" | "Customer" | …
  at: number;
}

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
  recent: RecentItem[];
  addRecent(item: Omit<RecentItem, "at">): void;

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
    { name: "jarvis-ui" }
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
