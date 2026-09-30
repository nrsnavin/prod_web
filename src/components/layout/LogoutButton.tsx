import { ReactNode, useState } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Log out, after a confirmation. One component because it lives in
 * three places — the desktop top bar, the phone menu and the profile
 * page — and three copies of "confirm, clear the session, go to login"
 * would drift.
 */
export function LogoutButton({
  className,
  children,
  iconOnly = false,
}: {
  className?: string;
  children?: ReactNode;
  iconOnly?: boolean;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className={className}
        title={iconOnly ? "Log out" : undefined}
        aria-label={iconOnly ? "Log out" : undefined}
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden />
        {!iconOnly && (children ?? "Log out")}
      </button>
      <ConfirmDialog
        open={confirm}
        title="Log out?"
        message="You'll need to sign in again to get back in."
        confirmLabel="Log out"
        loading={busy}
        onConfirm={run}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
