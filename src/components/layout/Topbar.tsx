import { useState } from "react";
import { Menu, Search, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemeToggle } from "./ThemeToggle";

export interface TopbarProps {
  onMenuClick: () => void;
  onSearchClick: () => void;
}

export function Topbar({ onMenuClick, onSearchClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-surface/90 backdrop-blur border-b border-ink-100 flex items-center gap-3 px-4 lg:px-6">
      <button
        className="lg:hidden p-2 rounded-lg text-ink-600 hover:bg-ink-100"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={onSearchClick}
        className="flex items-center gap-2 h-10 flex-1 max-w-md px-3 rounded-lg border border-ink-200 bg-canvas text-sm text-ink-400 hover:border-ink-400 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="hidden md:inline-block text-[11px] font-medium bg-surface border border-ink-200 rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden sm:block text-right leading-tight">
          <p className="text-sm font-semibold">{user?.username}</p>
          <p className="text-xs text-ink-400 capitalize">{user?.role}</p>
        </div>
        <span className="h-9 w-9 rounded-full bg-brand-100 text-brand-600 grid place-items-center font-bold text-sm uppercase">
          {user?.username?.charAt(0) ?? "?"}
        </span>
        <button
          onClick={() => setConfirmLogout(true)}
          className="p-2 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out?"
        message="You'll need to sign in again to get back in."
        confirmLabel="Log out"
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </header>
  );
}
