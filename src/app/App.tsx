import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useThemeEffect } from "@/core/ui/theme";
import { AppRouter } from "./router";
import { refetchIntervalFor, refetchOnFocusFor } from "./queryPolicy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // How often depends on what the data is — the shop floor every
      // 10 s, business records every minute, masters/reports/AI never on
      // a timer. See ./queryPolicy.ts. Only pages on screen poll;
      // background tabs don't (refetchIntervalInBackground stays false).
      refetchInterval: refetchIntervalFor,
      staleTime: 9_000, // < the shortest interval, so each live tick refetches
      refetchOnWindowFocus: refetchOnFocusFor,
    },
  },
});

export default function App() {
  // Keeps <html class="dark"> in step with the saved preference, and follows
  // the OS while that preference is "system".
  useThemeEffect();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
