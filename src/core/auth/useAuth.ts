import { useCallback } from "react";
import { useAuthStore } from "./authStore";
import { authService } from "./authService";
import { LoginCredentials } from "./types";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const session = await authService.login(credentials);
      setSession(session);
      return session;
    },
    [setSession]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    clearSession();
  }, [clearSession]);

  return { user, isAuthenticated: user !== null, login, logout };
}
