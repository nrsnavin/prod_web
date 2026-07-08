// Central runtime configuration. Everything environment-specific is read
// here once so no other module touches import.meta.env directly (DIP —
// modules depend on this abstraction, not on Vite's env mechanism).
export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string) || "/api/v2",
  appName: "Jarvis ERP",
} as const;
