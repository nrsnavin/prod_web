import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  PhoneCall, Truck, ShieldAlert, Info, HelpCircle, Boxes,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { complaintService } from "./api";
import type { ExposureRow, TraceResult, TracedLot } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHO ELSE GOT THE BAD YARN
//
//  One customer has called. This panel answers the only question that
//  matters in the next ten minutes: who else has this lot, and which of
//  them can still be stopped.
//
//  ── The ordering is the argument ─────────────────────────────────
//  Still here comes FIRST, above the customers who already have the
//  goods. That is deliberate and it is the opposite of how a report
//  like this usually reads. The delivered list is the bad news and the
//  eye goes to it; the in-house list is the only part anybody can still
//  act on, and by the time somebody has finished reading the bad news
//  the beam is on the loom.
//
//  ── Uncertainty is shown, never smoothed ─────────────────────────
//  A delivery challan names an order and a product, not a job. When an
//  order carries two jobs for the same product the challan belongs to
//  one of them and the data cannot say which. Those rows say so. A
//  clean-looking list with the wrong name on it means somebody rings a
//  customer to apologise for a defect they never received — which
//  costs more than the hedge does.
// ══════════════════════════════════════════════════════════════════

function LotChip({ lot }: { lot: TracedLot }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        lot.source === "issued"
          ? "bg-status-dangerBg/40 text-status-danger"
          : "bg-status-warningBg/40 text-status-warning"
      )}
      title={lot.source === "issued"
        ? "Issued — this yarn came off the rack"
        : "Programmed but not yet issued — this one can still be changed"}
    >
      <Boxes className="h-3.5 w-3.5 shrink-0" />
      <span className="font-medium tabular-nums">{lot.lotNo || "unnumbered lot"}</span>
      {lot.shade && <span className="opacity-70">{lot.shade}</span>}
      <span className="opacity-70">· {lot.source}</span>
    </span>
  );
}

function Row({ row }: { row: ExposureRow }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-t border-ink-100 py-2.5 first:border-t-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.customerName || "Unnamed customer"}</span>
          {!row.certain && (
            <span
              className="inline-flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500"
              title="A challan for this order and product has gone out, but the order carries more than one job for that product — this may not be the job that shipped."
            >
              <HelpCircle className="h-3 w-3" /> may not be this job
            </span>
          )}
          {row.finishedNotShipped && (
            <span className="rounded bg-status-warningBg/50 px-1.5 py-0.5 text-[11px] text-status-warning">
              finished, still here
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-500">
          {row.jobNo != null ? `Job ${row.jobNo}` : "Job"}
          {row.orderNo != null && ` · Order ${row.orderNo}`}
          {" · "}{row.jobStatus}
          {row.elastics.length > 0 && ` · ${row.elastics.map((e) => e.name).join(", ")}`}
        </p>
        {row.challans.length > 0 && (
          <p className="mt-0.5 text-xs text-ink-400 tabular-nums">
            {row.challans.map((d) => `${d.dcNumber} (${d.status})`).join(" · ")}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {/* Programmed vs issued matters here more than anywhere: a
            programme can still be rewritten. */}
        {row.via.includes("issued")
          ? <StatusChip tone="danger">lot issued</StatusChip>
          : <StatusChip tone="warning">lot programmed</StatusChip>}
      </div>
    </li>
  );
}

function Bucket({
  title, subtitle, rows, icon: Icon, tone,
}: {
  title: string; subtitle: string; rows: ExposureRow[];
  icon: typeof PhoneCall; tone: "danger" | "warning" | "success";
}) {
  const toneClass = {
    danger: "text-status-danger",
    warning: "text-status-warning",
    success: "text-status-success",
  }[tone];

  return (
    <div className="mt-4">
      <h3 className={cn("flex items-center gap-2 text-sm font-semibold", toneClass)}>
        <Icon className="h-4 w-4" />
        {title}
        <span className="tabular-nums">({rows.length})</span>
      </h3>
      <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">None.</p>
      ) : (
        <ul className="mt-2">{rows.map((r) => <Row key={r.jobId} row={r} />)}</ul>
      )}
    </div>
  );
}

function Body({ data }: { data: TraceResult }) {
  if (!data.ok) {
    return (
      <p className="mt-3 text-sm text-ink-400">
        {data.message ?? "There is no trail to follow for this complaint."}
      </p>
    );
  }

  const s = data.summary!;
  const e = data.exposure!;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-2xl font-bold tabular-nums">{s.otherJobs}</span>
          <span className="ml-2 text-ink-400">
            other job{s.otherJobs === 1 ? "" : "s"} carrying{" "}
            {s.lots === 1 ? "this lot" : `these ${s.lots} lots`}
          </span>
        </span>
        <span className="text-ink-500 tabular-nums">
          {s.otherCustomers} other customer{s.otherCustomers === 1 ? "" : "s"}
        </span>
      </div>

      {data.lots!.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.lots!.map((l, i) => <LotChip key={l.yarnLot ?? `${l.lotNo}-${i}`} lot={l} />)}
        </div>
      )}

      {/* Containable first. See the header. */}
      <Bucket
        title="Still here — stop these"
        subtitle="Nothing has gone out. This is the half you can still do something about."
        rows={e.inHouse}
        icon={ShieldAlert}
        tone="warning"
      />
      <Bucket
        title="In transit"
        subtitle="Dispatched, not yet marked delivered. Sometimes still stoppable."
        rows={e.inTransit}
        icon={Truck}
        tone="warning"
      />
      <Bucket
        title="Already delivered — call these customers"
        subtitle="The goods are with them. Too late to contain; these are the calls to make."
        rows={e.delivered}
        icon={PhoneCall}
        tone="danger"
      />

      {data.caveats!.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-ink-100 pt-3">
          {data.caveats!.map((c) => (
            <li key={c} className="flex items-start gap-1.5 text-xs text-ink-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function BlastRadiusPanel({ complaintId }: { complaintId: string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["complaint-trace", complaintId],
    queryFn: () => complaintService.trace(complaintId).then((r) => r.data),
    staleTime: 60_000,
  });

  return (
    <Card className="mb-4 p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          Who else has this lot
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-ink-400">
          Every other job carrying a yarn lot from the complained-of job, split by
          whether it has already reached the customer. Joins only — no model
          decides anything here.
        </p>
      </div>

      {/* `: null` was the whole failure path here — the heading and its
          explanation still drew, and the body silently disappeared. On
          this panel that reads as "nobody else has this lot", which is
          the one conclusion it exists to prevent somebody reaching by
          accident. */}
      {isLoading ? (
        <Skeleton className="mt-4 h-48 w-full" />
      ) : isError ? (
        <ErrorState
          error={error}
          what="the affected jobs"
          onRetry={() => refetch()}
        />
      ) : data ? (
        <Body data={data} />
      ) : null}
    </Card>
  );
}

export default BlastRadiusPanel;
