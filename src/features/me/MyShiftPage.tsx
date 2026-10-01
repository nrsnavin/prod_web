import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useMyToday } from "./hooks";
import { EnterProductionScreen, dayLabel, shiftName, shiftStatus } from "./components";
import { MyShift } from "./types";

// ══════════════════════════════════════════════════════════════════
//  MY SHIFT — the loom, head by head
//
//  What the worker needs at the machine: which elastic is on each head,
//  its key settings at a glance, and one tap to the full recipe. Then
//  how far the job has got, so they know what is still to weave.
// ══════════════════════════════════════════════════════════════════

const fmt = (n: number) => n.toLocaleString("en-IN");

function ShiftLoom({ shift, onEnter }: { shift: MyShift; onEnter: () => void }) {
  const status = shiftStatus(shift);
  const names = new Map(shift.heads.filter((h) => h.elastic).map((h) => [h.elastic!.id, h.elastic!.name]));
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm text-ink-500">{dayLabel(shift.date)} · {shiftName(shift.shift)}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{shift.machine?.code ?? "No loom yet"}</p>
            <p className="text-sm text-ink-500">
              {shift.machine ? [`${shift.machine.heads} heads`, shift.machine.manufacturer].filter(Boolean).join(" · ") : ""}
            </p>
          </div>
          <StatusChip tone={status.tone}>{status.text}</StatusChip>
        </div>
        {shift.description && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-700">{shift.description}</p>}
        <Button className="mt-4" onClick={onEnter}>
          {shift.status === "pending_verification" ? "Change my entry" : "Enter production"}
        </Button>
      </Card>

      <Card>
        <h2 className="px-5 pt-5 font-semibold">Heads</h2>
        {shift.heads.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState compact title="Nothing threaded on this loom" description="Ask your supervisor which elastic to run." /></div>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100">
            {shift.heads.map((h) => (
              <li key={h.head}>
                {h.elastic ? (
                  <Link
                    to={`/my/elastic/${h.elastic.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-ink-100/40"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-sm font-semibold tabular-nums" aria-label={`Head ${h.head}`}>
                      {h.head}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{h.elastic.name}</span>
                      <span className="block text-xs text-ink-500 tabular-nums">
                        {h.elastic.hooks} hooks · pick {h.elastic.pick} · {h.elastic.spandexEnds} spandex ends · {h.elastic.weightPerMetre} g/m
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                  </Link>
                ) : (
                  <p className="flex items-center gap-3 px-5 py-3 text-sm text-ink-400">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 font-semibold">{h.head}</span>
                    Empty head
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {shift.job && shift.job.elastics.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">
            Job J-{shift.job.jobNo}
            {shift.job.orderNo != null && <span className="font-normal text-ink-500"> · Order #{shift.job.orderNo}</span>}
          </h2>
          <ul className="mt-3 space-y-3">
            {shift.job.elastics.map((e) => {
              const pct = e.planned > 0 ? Math.min(100, Math.round((e.produced / e.planned) * 100)) : 0;
              return (
                <li key={e.elastic}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{names.get(e.elastic) ?? "Elastic on this job"}</span>
                    <span className="shrink-0 tabular-nums text-ink-600">{fmt(e.produced)} of {fmt(e.planned)} m</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100" role="img" aria-label={`${pct}% woven`}>
                    <div className="h-full rounded-full bg-status-success" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function MyShiftPage() {
  const today = useMyToday();
  const [entering, setEntering] = useState<MyShift | null>(null);

  return (
    <>
      <PageHeader title="My shift" subtitle="Your loom, what is on each head, and how far the job has got." />
      {today.isLoading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : today.isError ? (
        <Card><ErrorState error={today.error} what="your shift" onRetry={() => today.refetch()} /></Card>
      ) : (today.data ?? []).length === 0 ? (
        <Card className="p-5">
          <EmptyState compact icon={<CalendarCheck />} title="No shift assigned" description="When a supervisor plans you on a loom, it shows up here." />
        </Card>
      ) : (
        <div className="space-y-8">
          {today.data!.map((s) => <ShiftLoom key={s.id} shift={s} onEnter={() => setEntering(s)} />)}
        </div>
      )}
      <EnterProductionScreen shift={entering} onClose={() => setEntering(null)} />
    </>
  );
}
