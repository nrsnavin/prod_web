import { ClipboardList, ShieldCheck, CalendarOff, Fingerprint, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/core/auth/useAuth";
import { useActiveAnnouncements, useDashboardKpis, usePendingShiftCount } from "./hooks";
import { KpiTile } from "./components/KpiTile";
import { AttendanceCard } from "./components/AttendanceCard";
import { LowStockCard } from "./components/LowStockCard";
import { AnnouncementsCard } from "./components/AnnouncementsCard";
import { FloorCard } from "./components/FloorCard";
import { useMachines } from "@/features/machines/hooks";
import { useProductionRange } from "@/features/shifts/hooks";
import { toISODate } from "@/features/analytics/components/FilterBar";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useUiStore } from "@/core/ui/uiStore";
import { canAccessPath, effectiveDepartment } from "@/app/navigation";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { errorMessage } from "@/components/ui/ErrorState";

export function DashboardPage() {
  const { user } = useAuth();
  const recent = useUiStore((s) => s.recent);
  const dept = effectiveDepartment(user);
  // Only fetch what this department may access — a forbidden tile's
  // query would 403 and noise up the page.
  const canShifts = canAccessPath("/shift-verification", dept);
  const kpis = useDashboardKpis();
  const pendingShifts = usePendingShiftCount(canShifts);
  const announcements = useActiveAnnouncements();

  // The floor strip. Each part only for a department that may open the
  // screen it links to — and only then fetched.
  const canMachines = canAccessPath("/machines", dept);
  const canProduction = canAccessPath("/production", dept);
  const canOrders = canAccessPath("/orders", dept);
  const machines = useMachines("all", canMachines);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const production = useProductionRange(toISODate(yesterday), toISODate(today), canProduction);
  const dayTotal = (iso: string) =>
    production.data?.find((d) => d.date?.slice(0, 10) === iso)?.totalProduction ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const att = kpis.data?.attendanceToday;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.username ?? "there"}`}
        subtitle="Here's what's happening on the floor today."
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={kpis.isFetching}
            onClick={() => {
              kpis.refetch();
              pendingShifts.refetch();
              if (canMachines) machines.refetch();
              if (canProduction) production.refetch();
              announcements.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {kpis.isError && (
        // The shared banner, with Retry — the raw message here used to
        // read "["dashboard","kpis"] data is undefined".
        <ErrorBanner message={`Couldn't load the dashboard figures. ${errorMessage(kpis.error, "the dashboard figures")}`} />
      )}

      <FloorCard
        looms={
          canMachines
            ? {
                running: (machines.data ?? []).filter((m) => m.status === "running").length,
                maintenance: (machines.data ?? []).filter((m) => m.status === "maintenance").length,
                total: machines.data?.length ?? 0,
                loading: machines.isLoading,
              }
            : undefined
        }
        metres={
          canProduction
            ? {
                today: dayTotal(toISODate(today)),
                yesterday: dayTotal(toISODate(yesterday)),
                loading: production.isLoading,
              }
            : undefined
        }
        lateOrders={canOrders ? { count: kpis.data?.lateOrders, loading: kpis.isLoading } : undefined}
      />

      {/* Tiles are department-aware: each shows only when its target
          screen is accessible, so no tile ever links into a bounce. */}
      {/* Two across even on a phone: four full-width tiles took a screen
          and a half to say four numbers. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {canAccessPath("/jobs", dept) && (
          <KpiTile
            label="Open jobs"
            value={kpis.data?.openJobs ?? "—"}
            icon={ClipboardList}
            to="/jobs"
            loading={kpis.isLoading}
            footer="preparatory → packing"
          />
        )}
        {canShifts && (
          <KpiTile
            label="Shifts to verify"
            value={pendingShifts.data ?? "—"}
            icon={ShieldCheck}
            to="/shift-verification"
            loading={pendingShifts.isLoading}
            alert={(pendingShifts.data ?? 0) > 0}
            footer="submitted by workers"
          />
        )}
        {canAccessPath("/leave", dept) && (
          <KpiTile
            label="Pending leaves"
            value={kpis.data?.pendingLeaves ?? "—"}
            icon={CalendarOff}
            to="/leave"
            loading={kpis.isLoading}
            alert={(kpis.data?.pendingLeaves ?? 0) > 0}
            footer="awaiting decision"
          />
        )}
        {canAccessPath("/attendance", dept) && (
          <KpiTile
            label="Attendance today"
            value={att ? `${att.attendancePct}%` : "—"}
            icon={Fingerprint}
            to="/attendance"
            loading={kpis.isLoading}
            footer={att ? `${att.totalMarked}/${att.totalEmployees} marked` : undefined}
          />
        )}
      </div>

      {recent.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <History className="h-3.5 w-3.5" /> Recently viewed
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.map((r) => (
              <Link
                key={r.path}
                to={r.path}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-sm hover:border-brand-500 hover:text-brand-600 transition-colors"
              >
                <span className="text-xs text-ink-400">{r.type}</span>
                {r.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <AttendanceCard data={att} loading={kpis.isLoading} />
        <LowStockCard data={kpis.data?.lowStock} loading={kpis.isLoading} />
        <AnnouncementsCard
          items={announcements.data}
          loading={announcements.isLoading}
        />
      </div>
    </>
  );
}
