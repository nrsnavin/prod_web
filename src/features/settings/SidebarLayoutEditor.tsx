import { ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/core/auth/useAuth";
import { useUiStore } from "@/core/ui/uiStore";
import {
  visibleSections,
  UNHIDEABLE_PATHS,
  NavItem,
} from "@/app/navigation";

// Orders a section's items by the saved order (unknown items to the end),
// WITHOUT hiding — the editor needs to show hidden rows so they can be
// restored.
function orderedItems(items: NavItem[], order: string[] | undefined): NavItem[] {
  if (!order || !order.length) return items;
  const idx = (p: string) => {
    const i = order.indexOf(p);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...items].sort((a, b) => idx(a.path) - idx(b.path));
}

export function SidebarLayoutEditor() {
  const { user } = useAuth();
  const navHidden = useUiStore((s) => s.navHidden);
  const navOrder = useUiStore((s) => s.navOrder);
  const toggleNavHidden = useUiStore((s) => s.toggleNavHidden);
  const setSectionOrder = useUiStore((s) => s.setSectionOrder);
  const resetNavPrefs = useUiStore((s) => s.resetNavPrefs);

  const sections = visibleSections(user);
  const hidden = new Set(navHidden);

  const move = (sectionLabel: string, items: NavItem[], from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const paths = items.map((i) => i.path);
    const [p] = paths.splice(from, 1);
    paths.splice(to, 0, p);
    setSectionOrder(sectionLabel, paths);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          Reorder or hide items in your sidebar. This is personal to you and saved in this browser —
          it doesn't change what anyone else sees, and hidden pages stay reachable by their link.
        </p>
        <Button size="sm" variant="secondary" onClick={resetNavPrefs}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const items = orderedItems(section.items, navOrder[section.label]);
          return (
            <Card key={section.label} className="p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {section.label}
              </p>
              <ul className="space-y-1">
                {items.map((item, i) => {
                  const isHidden = hidden.has(item.path);
                  const locked = UNHIDEABLE_PATHS.includes(item.path);
                  return (
                    <li
                      key={item.path}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
                        isHidden ? "border-ink-100 bg-ink-50" : "border-ink-100 bg-white"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isHidden ? "text-ink-300" : "text-ink-500")} />
                      <span className={cn("flex-1 truncate text-sm", isHidden ? "text-ink-400 line-through" : "text-ink-800")}>
                        {item.label}
                      </span>
                      <button
                        onClick={() => move(section.label, items, i, i - 1)}
                        disabled={i === 0}
                        title="Move up"
                        className="p-1 rounded text-ink-400 hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => move(section.label, items, i, i + 1)}
                        disabled={i === items.length - 1}
                        title="Move down"
                        className="p-1 rounded text-ink-400 hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => !locked && toggleNavHidden(item.path)}
                        disabled={locked}
                        title={locked ? "Always shown" : isHidden ? "Show" : "Hide"}
                        className={cn(
                          "p-1 rounded hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent",
                          isHidden ? "text-ink-400" : "text-ink-500"
                        )}
                      >
                        {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
