import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { RequireAuth } from "./guards";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ComingSoonPage } from "@/features/common/ComingSoonPage";
import { allNavItems } from "./navigation";

// Feature pages are lazy-loaded so each module (and heavy deps like
// recharts) ships as its own chunk.
const lazyPage = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() =>
    loader().then((m) => ({ default: m[name] as React.ComponentType }))
  );

const AnalyticsPage = lazyPage(() => import("@/features/analytics/AnalyticsPage"), "AnalyticsPage");
const CustomerListPage = lazyPage(() => import("@/features/customers/CustomerListPage"), "CustomerListPage");
const CustomerDetailPage = lazyPage(() => import("@/features/customers/CustomerDetailPage"), "CustomerDetailPage");
const SupplierListPage = lazyPage(() => import("@/features/suppliers/SupplierListPage"), "SupplierListPage");
const PoListPage = lazyPage(() => import("@/features/suppliers/PoListPage"), "PoListPage");
const PoDetailPage = lazyPage(() => import("@/features/suppliers/PoDetailPage"), "PoDetailPage");
const MaterialListPage = lazyPage(() => import("@/features/materials/MaterialListPage"), "MaterialListPage");
const MaterialDetailPage = lazyPage(() => import("@/features/materials/MaterialDetailPage"), "MaterialDetailPage");
const ElasticListPage = lazyPage(() => import("@/features/elastics/ElasticListPage"), "ElasticListPage");
const ElasticDetailPage = lazyPage(() => import("@/features/elastics/ElasticDetailPage"), "ElasticDetailPage");
const MachineListPage = lazyPage(() => import("@/features/machines/MachineListPage"), "MachineListPage");
const MachineDetailPage = lazyPage(() => import("@/features/machines/MachineDetailPage"), "MachineDetailPage");
const EmployeeListPage = lazyPage(() => import("@/features/employees/EmployeeListPage"), "EmployeeListPage");
const EmployeeDetailPage = lazyPage(() => import("@/features/employees/EmployeeDetailPage"), "EmployeeDetailPage");
const OrderListPage = lazyPage(() => import("@/features/orders/OrderListPage"), "OrderListPage");
const OrderDetailPage = lazyPage(() => import("@/features/orders/OrderDetailPage"), "OrderDetailPage");
const JobListPage = lazyPage(() => import("@/features/jobs/JobListPage"), "JobListPage");
const JobDetailPage = lazyPage(() => import("@/features/jobs/JobDetailPage"), "JobDetailPage");
const MrpPage = lazyPage(() => import("@/features/jobs/MrpPage"), "MrpPage");
const DcListPage = lazyPage(() => import("@/features/deliveryChallans/DcListPage"), "DcListPage");
const DcDetailPage = lazyPage(() => import("@/features/deliveryChallans/DcDetailPage"), "DcDetailPage");

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
  "/customers": withSuspense(<CustomerListPage />),
  "/suppliers": withSuspense(<SupplierListPage />),
  "/purchase-orders": withSuspense(<PoListPage />),
  "/materials": withSuspense(<MaterialListPage />),
  "/elastics": withSuspense(<ElasticListPage />),
  "/machines": withSuspense(<MachineListPage />),
  "/employees": withSuspense(<EmployeeListPage />),
  "/orders": withSuspense(<OrderListPage />),
  "/jobs": withSuspense(<JobListPage />),
  "/delivery-challans": withSuspense(<DcListPage />),
};

// Detail routes that live under a nav destination.
const detailRoutes = [
  { path: "/customers/:id", element: withSuspense(<CustomerDetailPage />) },
  { path: "/purchase-orders/:id", element: withSuspense(<PoDetailPage />) },
  { path: "/materials/:id", element: withSuspense(<MaterialDetailPage />) },
  { path: "/elastics/:id", element: withSuspense(<ElasticDetailPage />) },
  { path: "/machines/:id", element: withSuspense(<MachineDetailPage />) },
  { path: "/employees/:id", element: withSuspense(<EmployeeDetailPage />) },
  { path: "/orders/:id", element: withSuspense(<OrderDetailPage />) },
  { path: "/jobs/:id", element: withSuspense(<JobDetailPage />) },
  { path: "/jobs/:id/mrp", element: withSuspense(<MrpPage />) },
  { path: "/delivery-challans/:id", element: withSuspense(<DcDetailPage />) },
];

const featureRoutes = [
  ...allNavItems
    .filter((item) => item.path !== "/")
    .map((item) => ({
      path: item.path,
      element: builtPages[item.path] ?? <ComingSoonPage />,
    })),
  ...detailRoutes,
];

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
