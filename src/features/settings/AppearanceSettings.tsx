import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { THEME_OPTIONS } from "@/components/layout/ThemeToggle";
import { useTheme, useDensity } from "@/core/ui/theme";
import type { Density } from "@/core/ui/uiStore";

/**
 * A miniature of the app shell — sidebar, topbar, a card and a chip —
 * rendered in a fixed theme so both options can be compared side by side
 * regardless of which one is active. Colours are literal here rather than
 * token-based precisely because the preview must *not* follow the theme.
 */
function ThemePreview({ mode }: { mode: "light" | "dark" }) {
  const c =
    mode === "dark"
      ? { page: "#0B101A", surface: "#141B29", line: "#2E3850", text: "#E8ECF4", muted: "#8F9AB0", accent: "#4F5FE8" }
      : { page: "#F4F5F8", surface: "#FFFFFF", line: "#D6DBE4", text: "#0F1729", muted: "#5F6B82", accent: "#3346D3" };

  return (
    <div
      className="flex h-24 gap-1.5 overflow-hidden rounded-lg p-1.5"
      style={{ background: c.page, border: `1px solid ${c.line}` }}
      aria-hidden="true"
    >
      {/* Sidebar */}
      <div
        className="flex w-8 shrink-0 flex-col gap-1 rounded p-1"
        style={{ background: c.surface }}
      >
        <div className="h-1.5 w-1.5 rounded-sm" style={{ background: "#E23744" }} />
        <div className="h-1 w-full rounded-sm" style={{ background: c.line }} />
        <div className="h-1 w-3/4 rounded-sm" style={{ background: c.line }} />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="h-3 rounded" style={{ background: c.surface }} />
        <div className="flex-1 rounded p-1.5" style={{ background: c.surface }}>
          <div className="h-1.5 w-2/3 rounded-sm" style={{ background: c.text }} />
          <div className="mt-1 h-1 w-1/2 rounded-sm" style={{ background: c.muted }} />
          <div className="mt-1.5 h-2 w-10 rounded-full" style={{ background: c.accent }} />
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme, resolved } = useTheme();

  return (
    <div className="max-w-2xl space-y-4">
    <Card className="p-5">
      <h3 className="font-semibold">Theme</h3>
      <p className="mt-1 text-sm text-ink-400">
        Applies to this browser only — it isn't shared with your other devices
        or with other users.
      </p>

      <div
        role="radiogroup"
        aria-label="Theme"
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {THEME_OPTIONS.map((o) => {
          const active = theme === o.value;
          // "System" previews whichever theme the OS currently reports.
          const previewMode = o.value === "system" ? resolved : o.value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.value)}
              className={cn(
                "rounded-xl border p-2.5 text-left transition-colors",
                active
                  ? "border-brand-500 ring-2 ring-brand-500/25"
                  : "border-ink-200 hover:border-ink-400"
              )}
            >
              <ThemePreview mode={previewMode} />
              <div className="mt-2.5 flex items-center gap-2">
                <o.icon className="h-4 w-4 shrink-0 text-ink-600" />
                <span className="flex-1 text-sm font-medium">{o.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-brand-500" />}
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{o.hint}</p>
            </button>
          );
        })}
      </div>

      {theme === "system" && (
        <p className="mt-4 text-xs text-ink-400">
          This device currently reports <strong className="text-ink-600">{resolved}</strong>{" "}
          mode. The app follows it as it changes — no reload needed.
        </p>
      )}
    </Card>
    <DensityCard />
    </div>
  );
}

const DENSITY_OPTIONS: Array<{ value: Density; label: string; hint: string; rows: number }> = [
  { value: "compact", label: "Compact", hint: "More rows on screen. Best with a mouse.", rows: 5 },
  { value: "comfortable", label: "Comfortable", hint: "Taller rows, easier to scan.", rows: 3 },
];

/** Table row height. A touch screen always uses comfortable rows. */
function DensityCard() {
  const { density, setDensity } = useDensity();
  return (
    <Card className="p-5">
      <h3 className="font-semibold">Table rows</h3>
      <p className="mt-1 text-sm text-ink-400">
        How tall each row of a list is. On a phone or tablet rows stay tall enough to tap.
      </p>
      <div role="radiogroup" aria-label="Table rows" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DENSITY_OPTIONS.map((o) => {
          const active = density === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setDensity(o.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                active ? "border-brand-500 ring-2 ring-brand-500/25" : "border-ink-200 hover:border-ink-400"
              )}
            >
              <div className="space-y-1 rounded-lg border border-ink-100 bg-surface-muted p-2" aria-hidden="true">
                {Array.from({ length: o.rows }, (_, i) => (
                  <div key={i} className={cn("rounded-sm bg-ink-100", o.value === "compact" ? "h-2" : "h-3.5")} />
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{o.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-brand-500" />}
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{o.hint}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
