import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, CircleSlash2, CircleMinus, Plane, CircleHelp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { chartTheme } from "@/core/charts/theme";
import { DashboardKpis } from "../api";

interface Segment {
  key: string;
  label: string;
  count: number;
  color: string;
  Icon: typeof CheckCircle2;
}

// Attendance states use the reserved status palette (state, not identity),
// always paired with an icon + label + count so color never stands alone.
export function AttendanceCard({
  data,
  loading,
}: {
  data?: DashboardKpis["attendanceToday"];
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-3 w-full" />
        <Skeleton className="mt-4 h-16 w-full" />
      </Card>
    );
  }

  const b = data.breakdown;
  const segments: Segment[] = [
    { key: "present", label: "Present", count: b.present, color: chartTheme.status.good, Icon: CheckCircle2 },
    { key: "late", label: "Late", count: b.late, color: chartTheme.status.warning, Icon: Clock3 },
    { key: "half_day", label: "Half day", count: b.half_day, color: chartTheme.status.serious, Icon: CircleMinus },
    { key: "absent", label: "Absent", count: b.absent, color: chartTheme.status.critical, Icon: CircleSlash2 },
    { key: "on_leave", label: "On leave", count: b.on_leave, color: chartTheme.mutedInk, Icon: Plane },
    // "Unmarked" is deliberately the faintest segment — via the ink token so
    // it stays faint against the card in either theme rather than becoming a
    // bright light-grey block on dark.
    { key: "unmarked", label: "Unmarked", count: data.unmarked, color: "rgb(var(--color-ink-200))", Icon: CircleHelp },
  ];
  const total = segments.reduce((s, x) => s + x.count, 0);

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Attendance today</h3>
        <Link to="/attendance" className="text-sm font-medium text-brand-600 hover:underline">
          View all
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-400">
        <span className="text-2xl font-bold text-ink-900">{data.attendancePct}%</span>{" "}
        effective · {data.totalMarked} of {data.totalEmployees} marked
      </p>

      {/* Stacked split bar — 2px surface gaps between segments */}
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-ink-100 gap-[2px]">
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.key}
                title={`${s.label}: ${s.count}`}
                style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              />
            ))}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {segments.map(({ key, label, count, color, Icon }) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <Icon className="h-4 w-4" style={{ color }} />
            <span className="text-ink-600">{label}</span>
            <span className="ml-auto font-semibold tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
