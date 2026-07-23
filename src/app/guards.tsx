import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "./navigation";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Department-aware guard for the current route. A user who navigates
// (or deep-links) to a path their department can't access is bounced to
// the dashboard, so the nav filtering can't be bypassed by typing a URL.
export function RequireDeptAccess({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!canAccessPath(location.pathname, user)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
