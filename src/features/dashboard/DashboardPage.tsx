import { ClipboardList, ShieldCheck, CalendarOff, Fingerprint, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/core/auth/useAuth";
import { useActiveAnnouncements, useDashboardKpis, usePendingShiftCount } from "./hooks";
import { KpiTile } from "./components/KpiTile";
import { AttendanceCard } from "./components/AttendanceCard";
import { LowStockCard } from "./components/LowStockCard";
import { AnnouncementsCard } from "./components/AnnouncementsCard";

export function DashboardPage() {
  const { user } = useAuth();
  const kpis = useDashboardKpis();
  const pendingShifts = usePendingShiftCount();
  const announcements = useActiveAnnouncements();

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
              announcements.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {kpis.isError && (
        <p className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          Couldn't load dashboard KPIs: {(kpis.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Open jobs"
          value={kpis.data?.openJobs ?? "—"}
          icon={ClipboardList}
          to="/jobs"
          loading={kpis.isLoading}
          footer="preparatory → packing"
        />
        <KpiTile
          label="Shifts to verify"
          value={pendingShifts.data ?? "—"}
          icon={ShieldCheck}
          to="/shift-verification"
          loading={pendingShifts.isLoading}
          alert={(pendingShifts.data ?? 0) > 0}
          footer="submitted by workers"
        />
        <KpiTile
          label="Pending leaves"
          value={kpis.data?.pendingLeaves ?? "—"}
          icon={CalendarOff}
          to="/leave"
          loading={kpis.isLoading}
          alert={(kpis.data?.pendingLeaves ?? 0) > 0}
          footer="awaiting decision"
        />
        <KpiTile
          label="Attendance today"
          value={att ? `${att.attendancePct}%` : "—"}
          icon={Fingerprint}
          to="/attendance"
          loading={kpis.isLoading}
          footer={att ? `${att.totalMarked}/${att.totalEmployees} marked` : undefined}
        />
      </div>

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
