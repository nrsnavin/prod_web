import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useTheme } from "@/core/ui/theme";
import { ThemeMode } from "@/core/ui/uiStore";

export const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
  hint: string;
}[] = [
  { value: "light", label: "Light", icon: Sun, hint: "Always the light theme" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Always the dark theme" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow this device's setting" },
];

/**
 * Topbar theme picker. The button shows the theme currently *rendered* (so
 * "System" still reads as a sun or moon), and the menu shows which of the
 * three preferences is actually selected.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — same pattern as Combobox.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const CurrentIcon = resolved === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
        title={`Theme: ${theme}`}
        aria-label={`Change theme (currently ${theme})`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CurrentIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-ink-200 bg-surface p-1 shadow-card-hover"
        >
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.value}
              role="menuitemradio"
              aria-checked={theme === o.value}
              onClick={() => {
                setTheme(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                theme === o.value
                  ? "bg-brand-50 font-medium text-brand-600"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              )}
            >
              <o.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{o.label}</span>
              {o.value === "system" && (
                <span className="text-xs text-ink-400">{resolved}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
