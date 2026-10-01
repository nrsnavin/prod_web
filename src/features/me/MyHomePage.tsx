import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Gauge, Megaphone, Recycle, Ruler } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/core/auth/useAuth";
import { KpiTile } from "@/features/dashboard/components/KpiTile";
import { useActiveAnnouncements } from "@/features/dashboard/hooks";
import { formatDate } from "@/core/format/date";
import { useMyAttendance, useMyPerformance, useMyToday, useMyWastage } from "./hooks";
import { EnterProductionScreen, ShiftCard } from "./components";
import { MyShift } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A WORKER'S HOME
//
//  The first screen after an employee logs in. Their shift comes first,
//  with the one thing to do about it; then how this month is going;
//  then the plant's notices. Nothing on it is anyone else's.
// ══════════════════════════════════════════════════════════════════

export function MyHomePage() {
  const { user } = useAuth();
  const today = useMyToday();
  const perf = useMyPerformance(30);
  const wastage = useMyWastage();
  const now = new Date();
  const attendance = useMyAttendance(now.getFullYear(), now.getMonth() + 1);
  const notices = useActiveAnnouncements();
  const [entering, setEntering] = useState<MyShift | null>(null);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const wastedThisMonth = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return (wastage.data ?? [])
      .filter((w) => new Date(w.incidentDate ?? w.createdAt).getTime() >= start)
      .reduce((t, w) => t + (w.quantity || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wastage.data]);

  const s = perf.data?.summary;
  const vsPlant =
    s?.avgPerShift != null && s.plantAvgPerShift
      ? Math.round(((s.avgPerShift - s.plantAvgPerShift) / s.plantAvgPerShift) * 100)
      : null;
  const present = attendance.data ? attendance.data.stats.present + attendance.data.stats.late : null;

  return (
    <>
      <PageHeader title={`${greeting}, ${user?.username?.split(" ")[0] ?? "there"}`} subtitle="Your shift, your numbers, and the plant's notices." />

      <section aria-labelledby="my-shift-heading">
        <h2 id="my-shift-heading" className="sr-only">Your shift</h2>
        {today.isLoading ? (
          <Skeleton className="h-48 w-full rounded-card" />
        ) : today.isError ? (
          <Card><ErrorState error={today.error} what="your shift" onRetry={() => today.refetch()} /></Card>
        ) : (today.data ?? []).length === 0 ? (
          <Card className="p-5">
            <EmptyState
              compact
              icon={<CalendarCheck />}
              title="No shift assigned"
              description="When a supervisor plans you on a loom, it shows up here."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {today.data!.map((sh) => (
              <ShiftCard key={sh.id} shift={sh} onEnter={() => setEntering(sh)} />
            ))}
          </div>
        )}
      </section>

      <h2 className="mt-6 mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Last 30 days</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiTile
          label="Average per shift"
          value={s?.avgPerShift != null ? `${s.avgPerShift.toLocaleString("en-IN")} m` : "—"}
          icon={Ruler}
          to="/my/performance"
          loading={perf.isLoading}
          footer={s?.changePct != null ? `${s.changePct > 0 ? "▲" : s.changePct < 0 ? "▼" : "■"} ${Math.abs(s.changePct)}% on the 30 days before` : `${s?.shifts ?? 0} shifts`}
        />
        <KpiTile
          label="Against the plant"
          value={vsPlant != null ? `${vsPlant > 0 ? "+" : ""}${vsPlant}%` : "—"}
          icon={Gauge}
          to="/my/performance"
          loading={perf.isLoading}
          footer={s?.plantAvgPerShift != null ? `plant ${s.plantAvgPerShift.toLocaleString("en-IN")} m a shift` : "no plant figure yet"}
        />
        <KpiTile
          label="Wastage this month"
          value={`${wastedThisMonth.toLocaleString("en-IN")} m`}
          icon={Recycle}
          to="/my/performance"
          loading={wastage.isLoading}
          alert={wastedThisMonth > 0}
          footer="recorded against you"
        />
        <KpiTile
          label="Present this month"
          value={present != null ? String(present) : "—"}
          icon={CalendarCheck}
          to="/my/pay"
          loading={attendance.isLoading}
          footer={attendance.data ? `${attendance.data.stats.absent} absent · ${attendance.data.stats.onLeave} on leave` : "shifts"}
        />
      </div>

      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Megaphone className="h-4 w-4 text-ink-400" aria-hidden /> Notices
        </h2>
        {notices.isLoading ? (
          <Skeleton className="mt-3 h-16 w-full" />
        ) : (notices.data ?? []).length === 0 ? (
          <EmptyState compact title="No notices right now" />
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {notices.data!.slice(0, 5).map((n) => (
              <li key={n._id} className="py-3">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-ink-600 whitespace-pre-line">{n.body}</p>}
                {n.createdAt && <p className="mt-1 text-xs text-ink-400">{formatDate(n.createdAt)}</p>}
              </li>
            ))}
          </ul>
        )}
        <Link to="/announcements" className="mt-2 inline-block text-sm font-medium text-brand-600">All notices</Link>
      </Card>

      <EnterProductionScreen shift={entering} onClose={() => setEntering(null)} />
    </>
  );
}
