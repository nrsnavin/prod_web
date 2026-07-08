import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setUnauthorizedHandler } from "@/core/http/httpClient";
import { SessionUser } from "./types";

interface AuthState {
  user: SessionUser | null;
  setSession(user: SessionUser): void;
  clearSession(): void;
}

// Session identity persists in localStorage; the credential itself lives
// in the httpOnly cookie the backend owns. A stale localStorage session
// with an expired cookie self-heals via the 401 handler below.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setSession: (user) => set({ user }),
      clearSession: () => set({ user: null }),
    }),
    { name: "jarvis-session" }
  )
);

// Any 401 from the API drops the session, which routes back to /login.
setUnauthorizedHandler(() => {
  const { user, clearSession } = useAuthStore.getState();
  if (user) clearSession();
});
