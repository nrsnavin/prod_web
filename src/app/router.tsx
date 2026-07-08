import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { RequireAuth } from "./guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ComingSoonPage } from "@/features/common/ComingSoonPage";
import { allNavItems } from "./navigation";

// Heavy pages are lazy-loaded so their dependencies (e.g. recharts) stay
// out of the main bundle.
const AnalyticsPage = lazy(() =>
  import("@/features/analytics/AnalyticsPage").then((m) => ({
    default: m.AnalyticsPage,
  }))
);

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

const withSuspense = (el: JSX.Element) => (
  <Suspense fallback={<PageFallback />}>{el}</Suspense>
);

// Built pages, keyed by nav path. Later stages add entries here; every
// other nav destination falls back to ComingSoonPage.
const builtPages: Record<string, JSX.Element> = {
  "/analytics": withSuspense(<AnalyticsPage />),
};

const featureRoutes = allNavItems
  .filter((item) => item.path !== "/")
  .map((item) => ({
    path: item.path,
    element: builtPages[item.path] ?? <ComingSoonPage />,
  }));

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [{ index: true, element: <DashboardPage /> }, ...featureRoutes],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
