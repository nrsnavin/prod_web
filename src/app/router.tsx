import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "./guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ComingSoonPage } from "@/features/common/ComingSoonPage";
import { allNavItems } from "./navigation";

// Every nav destination gets a route. Pages built in later stages replace
// their ComingSoonPage element here — the route table itself is stable.
const featureRoutes = allNavItems
  .filter((item) => item.path !== "/")
  .map((item) => ({ path: item.path, element: <ComingSoonPage /> }));

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
