import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { visibleSections } from "@/app/navigation";
import { useAuth } from "@/core/auth/useAuth";
import { cn } from "@/components/ui/cn";
import { config } from "@/app/config";

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth();
  const sections = visibleSections(user?.role);

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-ink-100 flex flex-col",
          "transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-brand-500 text-white grid place-items-center font-bold text-sm">
              J
            </span>
            <span className="font-bold text-lg tracking-tight">
              {config.appName}
            </span>
          </div>
          <button
            className="lg:hidden p-1 rounded-lg text-ink-400 hover:bg-ink-100"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map(({ label, path, icon: Icon }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      end={path === "/"}
                      onClick={onMobileClose}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-brand-50 text-brand-600"
                            : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                        )
                      }
                    >
                      <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
