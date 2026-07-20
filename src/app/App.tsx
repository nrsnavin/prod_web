import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AppRouter } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Live floor data: every mounted query re-polls every 10s while
      // the tab is visible, so all screens stay current without a manual
      // reload. Only the pages currently on screen poll; background tabs
      // don't (refetchIntervalInBackground stays false).
      refetchInterval: 10_000,
      staleTime: 9_000, // < the poll interval so each tick refetches
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
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
