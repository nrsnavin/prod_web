import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
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
const ReportsLandingPage = lazyPage(() => import("@/features/reports/ReportsLandingPage"), "ReportsLandingPage");
const ProductionReportPage = lazyPage(() => import("@/features/reports/ProductionReportPage"), "ProductionReportPage");
const DispatchReportPage = lazyPage(() => import("@/features/reports/DispatchReportPage"), "DispatchReportPage");
const OrderBookReportPage = lazyPage(() => import("@/features/reports/OrderBookReportPage"), "OrderBookReportPage");
const StockPurchasesReportPage = lazyPage(() => import("@/features/reports/StockPurchasesReportPage"), "StockPurchasesReportPage");
const StockMovementsReportPage = lazyPage(() => import("@/features/reports/StockMovementsReportPage"), "StockMovementsReportPage");
const CustomerListPage = lazyPage(() => import("@/features/customers/CustomerListPage"), "CustomerListPage");
const CustomerDetailPage = lazyPage(() => import("@/features/customers/CustomerDetailPage"), "CustomerDetailPage");
const SupplierListPage = lazyPage(() => import("@/features/suppliers/SupplierListPage"), "SupplierListPage");
const PoListPage = lazyPage(() => import("@/features/suppliers/PoListPage"), "PoListPage");
const PoCreatePage = lazyPage(() => import("@/features/suppliers/PoCreatePage"), "PoCreatePage");
const PoDetailPage = lazyPage(() => import("@/features/suppliers/PoDetailPage"), "PoDetailPage");
const MaterialListPage = lazyPage(() => import("@/features/materials/MaterialListPage"), "MaterialListPage");
const MaterialDetailPage = lazyPage(() => import("@/features/materials/MaterialDetailPage"), "MaterialDetailPage");
const MaterialForecastPage = lazyPage(() => import("@/features/materials/MaterialForecastPage"), "MaterialForecastPage");
const ElasticListPage = lazyPage(() => import("@/features/elastics/ElasticListPage"), "ElasticListPage");
const ElasticDetailPage = lazyPage(() => import("@/features/elastics/ElasticDetailPage"), "ElasticDetailPage");
const ElasticGroupsPage = lazyPage(() => import("@/features/elasticGroups/ElasticGroupsPage"), "ElasticGroupsPage");
const ElasticGroupDetailPage = lazyPage(() => import("@/features/elasticGroups/ElasticGroupDetailPage"), "ElasticGroupDetailPage");
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
const WarpingListPage = lazyPage(() => import("@/features/warping/WarpingListPage"), "WarpingListPage");
const WarpingDetailPage = lazyPage(() => import("@/features/warping/WarpingDetailPage"), "WarpingDetailPage");
const CoveringListPage = lazyPage(() => import("@/features/warping/CoveringListPage"), "CoveringListPage");
const CoveringDetailPage = lazyPage(() => import("@/features/warping/CoveringDetailPage"), "CoveringDetailPage");
const PackingPage = lazyPage(() => import("@/features/packing/PackingPage"), "PackingPage");
const PlanningPage = lazyPage(() => import("@/features/planning/PlanningPage"), "PlanningPage");
const AuditPage = lazyPage(() => import("@/features/audit/AuditPage"), "AuditPage");
const QcPage = lazyPage(() => import("@/features/qc/QcPage"), "QcPage");
const ShiftPlansPage = lazyPage(() => import("@/features/shifts/ShiftPlansPage"), "ShiftPlansPage");
const ShiftPlanDetailPage = lazyPage(() => import("@/features/shifts/ShiftPlanDetailPage"), "ShiftPlanDetailPage");
const ShiftVerificationPage = lazyPage(() => import("@/features/shifts/ShiftVerificationPage"), "ShiftVerificationPage");
const ProductionViewPage = lazyPage(() => import("@/features/shifts/ProductionViewPage"), "ProductionViewPage");
const WastagePage = lazyPage(() => import("@/features/wastage/WastagePage"), "WastagePage");
const AttendancePage = lazyPage(() => import("@/features/hr/AttendancePage"), "AttendancePage");
const PayrollPage = lazyPage(() => import("@/features/hr/PayrollPage"), "PayrollPage");
const BonusPage = lazyPage(() => import("@/features/hr/BonusPage"), "BonusPage");
const LeavePage = lazyPage(() => import("@/features/hr/LeavePage"), "LeavePage");
const AnnouncementsPage = lazyPage(() => import("@/features/comms/AnnouncementsPage"), "AnnouncementsPage");
const FeedbackPage = lazyPage(() => import("@/features/comms/FeedbackPage"), "FeedbackPage");
const MachineIssuesPage = lazyPage(() => import("@/features/comms/MachineIssuesPage"), "MachineIssuesPage");
const NotificationSettingsPage = lazyPage(() => import("@/features/comms/NotificationSettingsPage"), "NotificationSettingsPage");
const AdvisorPage = lazyPage(() => import("@/features/comms/AdvisorPage"), "AdvisorPage");
const AssistantPage = lazyPage(() => import("@/features/assistant/AssistantPage"), "AssistantPage");
const DataIoPage = lazyPage(() => import("@/features/comms/DataIoPage"), "DataIoPage");

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
  "/reports": withSuspense(<ReportsLandingPage />),
  "/customers": withSuspense(<CustomerListPage />),
  "/suppliers": withSuspense(<SupplierListPage />),
  "/purchase-orders": withSuspense(<PoListPage />),
  "/materials": withSuspense(<MaterialListPage />),
  "/elastics": withSuspense(<ElasticListPage />),
  "/elastic-groups": withSuspense(<ElasticGroupsPage />),
  "/machines": withSuspense(<MachineListPage />),
  "/employees": withSuspense(<EmployeeListPage />),
  "/orders": withSuspense(<OrderListPage />),
  "/jobs": withSuspense(<JobListPage />),
  "/delivery-challans": withSuspense(<DcListPage />),
  "/warping": withSuspense(<WarpingListPage />),
  "/covering": withSuspense(<CoveringListPage />),
  "/packing": withSuspense(<PackingPage />),
  "/qc": withSuspense(<QcPage />),
  "/planner": withSuspense(<PlanningPage />),
  "/audit": withSuspense(<AuditPage />),
  "/shift-plans": withSuspense(<ShiftPlansPage />),
  "/shift-verification": withSuspense(<ShiftVerificationPage />),
  "/production": withSuspense(<ProductionViewPage />),
  "/wastage": withSuspense(<WastagePage />),
  "/attendance": withSuspense(<AttendancePage />),
  "/payroll": withSuspense(<PayrollPage />),
  "/bonus": withSuspense(<BonusPage />),
  "/leave": withSuspense(<LeavePage />),
  "/announcements": withSuspense(<AnnouncementsPage />),
  "/feedback": withSuspense(<FeedbackPage />),
  "/machine-issues": withSuspense(<MachineIssuesPage />),
  "/notification-settings": withSuspense(<NotificationSettingsPage />),
  "/advisor": withSuspense(<AdvisorPage />),
  "/assistant": withSuspense(<AssistantPage />),
  "/data-io": withSuspense(<DataIoPage />),
};

// Detail routes that live under a nav destination.
const detailRoutes = [
  { path: "/reports/production", element: withSuspense(<ProductionReportPage />) },
  { path: "/reports/dispatch", element: withSuspense(<DispatchReportPage />) },
  { path: "/reports/order-book", element: withSuspense(<OrderBookReportPage />) },
  { path: "/reports/stock-purchases", element: withSuspense(<StockPurchasesReportPage />) },
  { path: "/reports/stock-movements", element: withSuspense(<StockMovementsReportPage />) },
  { path: "/customers/:id", element: withSuspense(<CustomerDetailPage />) },
  { path: "/purchase-orders/new", element: withSuspense(<PoCreatePage />) },
  { path: "/purchase-orders/:id", element: withSuspense(<PoDetailPage />) },
  { path: "/materials/forecast", element: withSuspense(<MaterialForecastPage />) },
  { path: "/materials/:id", element: withSuspense(<MaterialDetailPage />) },
  { path: "/elastics/:id", element: withSuspense(<ElasticDetailPage />) },
  { path: "/elastic-groups/:id", element: withSuspense(<ElasticGroupDetailPage />) },
  { path: "/machines/:id", element: withSuspense(<MachineDetailPage />) },
  { path: "/employees/:id", element: withSuspense(<EmployeeDetailPage />) },
  { path: "/orders/:id", element: withSuspense(<OrderDetailPage />) },
  { path: "/jobs/:id", element: withSuspense(<JobDetailPage />) },
  { path: "/jobs/:id/mrp", element: withSuspense(<MrpPage />) },
  { path: "/delivery-challans/:id", element: withSuspense(<DcDetailPage />) },
  { path: "/warping/:id", element: withSuspense(<WarpingDetailPage />) },
  { path: "/covering/:id", element: withSuspense(<CoveringDetailPage />) },
  { path: "/shift-plans/:id", element: withSuspense(<ShiftPlanDetailPage />) },
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
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
