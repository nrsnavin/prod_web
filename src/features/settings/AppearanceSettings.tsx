import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { THEME_OPTIONS } from "@/components/layout/ThemeToggle";
import { useTheme } from "@/core/ui/theme";

/**
 * A miniature of the app shell — sidebar, topbar, a card and a chip —
 * rendered in a fixed theme so both options can be compared side by side
 * regardless of which one is active. Colours are literal here rather than
 * token-based precisely because the preview must *not* follow the theme.
 */
function ThemePreview({ mode }: { mode: "light" | "dark" }) {
  const c =
    mode === "dark"
      ? { page: "#131316", surface: "#1c1c20", line: "#34343a", text: "#f4f4f5", muted: "#86868e" }
      : { page: "#f8f8f8", surface: "#ffffff", line: "#e0e0e0", text: "#1c1c1c", muted: "#828282" };

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
        <div className="h-1.5 w-full rounded-sm" style={{ background: "#E23744" }} />
        <div className="h-1 w-full rounded-sm" style={{ background: c.line }} />
        <div className="h-1 w-3/4 rounded-sm" style={{ background: c.line }} />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="h-3 rounded" style={{ background: c.surface }} />
        <div className="flex-1 rounded p-1.5" style={{ background: c.surface }}>
          <div className="h-1.5 w-2/3 rounded-sm" style={{ background: c.text }} />
          <div className="mt-1 h-1 w-1/2 rounded-sm" style={{ background: c.muted }} />
          <div className="mt-1.5 h-2 w-10 rounded-full" style={{ background: "#E23744" }} />
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme, resolved } = useTheme();

  return (
    <Card className="max-w-2xl p-5">
      <h3 className="font-semibold">Theme</h3>
      <p className="mt-1 text-sm text-ink-400">
        Applies to this browser only — it isn't shared with your other devices
        or with other users.
      </p>

      <div
        role="radiogroup"
        aria-label="Theme"
        className="mt-4 grid gap-3 sm:grid-cols-3"
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
  );
}
