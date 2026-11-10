import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RefreshCw, History } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/core/auth/useAuth";
import { useUiStore } from "@/core/ui/uiStore";
import { canAccessPath, effectiveDepartment } from "@/app/navigation";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { errorMessage } from "@/components/ui/ErrorState";
import { ApiError } from "@/core/http/httpClient";
import { OpeningOnboardingCard } from "@/features/accounts/OpeningOnboardingCard";
import { useActiveAnnouncements, useDashboardKpis, useDashboardOverview } from "./hooks";
import { AttendanceCard } from "./components/AttendanceCard";
import { AnnouncementsCard } from "./components/AnnouncementsCard";
import { AttentionList } from "./components/AttentionList";
import { HeadlineTiles } from "./components/HeadlineTiles";
import { FloorNowCard, MoneyCard } from "./components/SideCards";

// ══════════════════════════════════════════════════════════════════
//  HOME
//
//  It used to greet and then count paperwork, with no money on it, and
//  said "everything on time" while orders were forecast late. It now
//  leads with four numbers chosen by role, each against something, then
//  what needs a decision, then the floor and the money. One-time setup
//  (opening balances) comes after the work, not above it.
// ══════════════════════════════════════════════════════════════════

export function DashboardPage() {
  const { user } = useAuth();
  const recent = useUiStore((s) => s.recent);
  const dept = effectiveDepartment(user);
  const canOpen = (path: string) => canAccessPath(path, dept);

  const overview = useDashboardOverview();
  const kpis = useDashboardKpis();
  const announcements = useActiveAnnouncements();
  // A role without a plant dashboard is refused; that is not an error to show.
  const refused = overview.error instanceof ApiError && overview.error.status === 403;
  const o = overview.data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.username ?? "there"}`}
        subtitle={today}
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={overview.isFetching}
            onClick={() => {
              overview.refetch();
              kpis.refetch();
              announcements.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {overview.isError && !refused && (
        <ErrorBanner message={`Couldn't load the dashboard figures. ${errorMessage(overview.error, "the dashboard figures")}`} />
      )}

      {!refused && (
        <>
          <ErrorBoundary variant="section" label="The figures">
            <HeadlineTiles data={o} loading={overview.isLoading} canOpen={canOpen} />
          </ErrorBoundary>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ErrorBoundary variant="section" label="What needs you">
                <AttentionList items={o?.attention} loading={overview.isLoading} canOpen={canOpen} />
              </ErrorBoundary>
            </div>
            <div className="space-y-4">
              <ErrorBoundary variant="section" label="The floor">
                <FloorNowCard floor={o?.floor} loading={overview.isLoading} canOpen={canOpen} />
              </ErrorBoundary>
              <ErrorBoundary variant="section" label="Money">
                <MoneyCard money={o?.money} loading={overview.isLoading} canOpen={canOpen} />
              </ErrorBoundary>
            </div>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-ink-500">
            <History className="h-3.5 w-3.5" /> Recently viewed
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recent.map((r) => (
              <Link
                key={r.path}
                to={r.path}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-sm transition-colors hover:border-brand-500 hover:text-brand-600"
              >
                <span className="text-xs text-ink-400">{r.type}</span>
                {r.label}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {!refused && (
          <ErrorBoundary variant="section" label="Attendance">
            <AttendanceCard data={kpis.data?.attendanceToday} loading={kpis.isLoading} canOpen={canOpen} />
          </ErrorBoundary>
        )}
        <ErrorBoundary variant="section" label="Announcements">
          <AnnouncementsCard items={announcements.data} loading={announcements.isLoading} />
        </ErrorBoundary>
      </div>

      {/* Setup after the work: it goes away once every balance is set. */}
      {canOpen("/accounts") && (
        <div className="mt-4">
          <ErrorBoundary variant="section" label="Opening balances">
            <OpeningOnboardingCard />
          </ErrorBoundary>
        </div>
      )}
    </>
  );
}
