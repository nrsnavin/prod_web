// Central runtime configuration. Everything environment-specific is read
// here once so no other module touches import.meta.env directly (DIP —
// modules depend on this abstraction, not on Vite's env mechanism).
export const config = {
  // Resolution order:
  //  1. VITE_API_BASE_URL — explicit override at build time (any env).
  //  2. Production build with no override → the real HTTPS backend.
  //  3. Dev → relative "/api/v2", which Vite proxies to the backend
  //     (same-origin, so the httpOnly auth cookie is accepted).
  apiBaseUrl:
    (import.meta.env.VITE_API_BASE_URL as string) ||
    (import.meta.env.PROD ? "https://api.baluelastics.com/api/v2" : "/api/v2"),
  appName: "Jarvis ERP",
} as const;
