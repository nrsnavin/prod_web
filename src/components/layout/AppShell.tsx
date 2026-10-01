import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RequireDeptAccess } from "@/app/guards";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { GlobalSearch } from "./GlobalSearch";
import { BottomNav } from "./BottomNav";
import { PullToRefresh } from "./PullToRefresh";
import { useUiStore } from "@/core/ui/uiStore";
import { cn } from "@/components/ui/cn";
import { authService } from "@/core/auth/authService";
import { useAuthStore } from "@/core/auth/authStore";

/**
 * Refreshes the saved session from the server once per app load. The
 * session was only ever written at sign-in, so a change an admin made
 * since — a new feature, a login made an employee login — did not reach
 * anyone already signed in until they signed out and back in.
 */
function useSessionRefresh() {
  const setSession = useAuthStore((s) => s.setSession);
  useEffect(() => {
    let live = true;
    authService
      .fetchCurrentUser()
      .then((u) => live && setSession(u))
      .catch(() => undefined); // a 401 already clears the session (authStore)
    return () => {
      live = false;
    };
  }, [setSession]);
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  useSessionRefresh();

  // ⌘K / Ctrl+K opens global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      {/* Below lg the side insets keep content clear of a landscape phone's
          notch; at lg the sidebar offset takes over. */}
      <div className={cn("flex flex-col min-h-screen transition-all pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
        />
        {/* Below lg the bottom bar (~56px) sits over the page's foot, so the
            page ends above it. */}
        <main className="flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:p-6 lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <RequireDeptAccess>
            {/* A short fade as each screen arrives, so the eye sees the
                change rather than a jump; off under reduce-motion. */}
            <div key={pathname} className="motion-safe:animate-fade-in">
              <Outlet />
            </div>
          </RequireDeptAccess>
        </main>
      </div>
      <PullToRefresh />
      <BottomNav onMore={() => setMobileNavOpen(true)} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
