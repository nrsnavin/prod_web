import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, FileText, Save, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { pnlService } from "./api";
import { useOrderPnl, usePnlMutations } from "./hooks";
import { MAX_RATE, marginLabel, marginTone, meters, rupee, rupeePrecise } from "./format";
import type { OrderPnl, PnlJobRow } from "./types";

// One order's P&L. Every figure is derived from documents elsewhere in
// the system, so the only things editable here are the three inputs
// nothing else owns: the selling rate, a job's actual conversion cost,
// and (on the list page) the ₹/meter rate card.

const COST_LINES = [
  { key: "material", label: "Yarn issued", hint: "At the price captured when it was issued" },
  { key: "labour", label: "Wages", hint: "Scheduled shift hours × the operator's rate" },
  { key: "jobWork", label: "Outsourced job-work", hint: "Vendor rate × meters returned" },
  { key: "finishing", label: "Finishing", hint: "Rate card, or the job's own figure" },
  { key: "checking", label: "Checking", hint: "Rate card, or the job's own figure" },
  { key: "packing", label: "Packing", hint: "Rate card, or the job's own figure" },
  { key: "overhead", label: "Overhead", hint: "Power, rent, depreciation per meter" },
] as const;

// ── Selling rates ────────────────────────────────────────────────
function RevenueCard({ pnl }: { pnl: OrderPnl }) {
  const { saveRates } = usePnlMutations(pnl.order.id);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const value = (id: string, rate: number) => draft[id] ?? String(rate);

  const save = () => {
    const rates = Object.entries(draft)
      // A CLEARED box is not a price of zero. Number("") is 0, and 0 is
      // this app's signal for "not priced" — so sending it would
      // silently un-price the line the planner was only mid-edit on.
      .filter(([, raw]) => raw.trim() !== "")
      .map(([elastic, raw]) => ({ elastic, rate: Number(raw) }))
      .filter((r) => Number.isFinite(r.rate) && r.rate >= 0 && r.rate <= MAX_RATE);
    if (rates.length === 0) return;
    saveRates.mutate(rates, { onSuccess: () => setDraft({}) });
  };

  // Flag the two inputs the server will refuse, before the round trip.
  const badRates = Object.entries(draft).filter(([, raw]) => {
    if (raw.trim() === "") return false;
    const n = Number(raw);
    return !Number.isFinite(n) || n < 0 || n > MAX_RATE;
  });

  // What the lines add up to as typed, so the order value moves with the
  // form rather than only after a save.
  const preview = pnl.revenue.lines.reduce((s, l) => {
    const r = draft[l.elasticId] !== undefined ? Number(draft[l.elasticId]) : l.rate;
    return s + l.quantity * (Number.isFinite(r) ? r : 0);
  }, 0);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Revenue</h2>
        <Button
          size="sm"
          loading={saveRates.isPending}
          disabled={Object.keys(draft).length === 0 || badRates.length > 0}
          onClick={save}
        >
          <Save className="h-4 w-4" /> Save rates
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {pnl.revenue.lines.map((l) => (
          <div key={l.elasticId} className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <p className="text-sm font-medium">{l.name}</p>
              <p className="text-xs text-ink-400 tabular-nums">{meters(l.quantity)} ordered</p>
            </div>
            <div className="w-32">
              <Input
                label="Rate ₹/m"
                type="number"
                step="0.01"
                min="0"
                value={value(l.elasticId, l.rate)}
                onChange={(e) => setDraft((d) => ({ ...d, [l.elasticId]: e.target.value }))}
              />
            </div>
            <div className="w-28 pb-2.5 text-right text-sm tabular-nums">
              {rupee(
                l.quantity *
                  (draft[l.elasticId] !== undefined ? Number(draft[l.elasticId]) || 0 : l.rate)
              )}
            </div>
          </div>
        ))}
        {pnl.revenue.lines.length === 0 && (
          <p className="text-sm text-ink-400">This order has no lines.</p>
        )}
      </div>

      {badRates.length > 0 && (
        <p className="mt-3 text-sm text-status-danger">
          A rate must be between 0 and {MAX_RATE.toLocaleString("en-IN")} per meter.
        </p>
      )}

      <dl className="mt-4 space-y-1.5 border-t border-ink-100 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="font-medium">Order value</dt>
          <dd className="font-semibold tabular-nums">{rupee(preview)}</dd>
        </div>
        <div className="flex justify-between text-ink-400">
          {/* Invoiced sits BESIDE the order value, never instead of it —
              an order that has not shipped has still spent real money. */}
          <dt>
            Invoiced so far
            {pnl.revenue.invoiced.challans > 0 && ` (${pnl.revenue.invoiced.challans} challan${
              pnl.revenue.invoiced.challans === 1 ? "" : "s"
            })`}
          </dt>
          <dd className="tabular-nums">{rupee(pnl.revenue.invoiced.amount)}</dd>
        </div>
      </dl>
    </Card>
  );
}

// ── Cost breakdown ───────────────────────────────────────────────
function CostCard({ pnl }: { pnl: OrderPnl }) {
  const total = pnl.costs.total;
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Cost</h2>
      <div className="mt-4 space-y-2.5">
        {COST_LINES.map(({ key, label, hint }) => {
          const amount = pnl.costs[key];
          const share = total > 0 ? Math.round((amount / total) * 100) : 0;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums">{rupee(amount)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-ink-400 tabular-nums">{share}%</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-between border-t border-ink-100 pt-3 text-sm">
        <span className="font-medium">Total cost</span>
        <span className="font-semibold tabular-nums">{rupee(total)}</span>
      </div>
      {pnl.totals.costPerMeter != null && (
        <div className="mt-1 flex justify-between text-sm text-ink-400">
          <span>Per meter produced</span>
          <span className="tabular-nums">{rupeePrecise(pnl.totals.costPerMeter)}</span>
        </div>
      )}
    </Card>
  );
}

// ── One job's actual conversion cost ─────────────────────────────
const OVERRIDE_FIELDS = [
  { key: "finishing", label: "Finishing" },
  { key: "checking", label: "Checking" },
  { key: "packing", label: "Packing" },
  { key: "overhead", label: "Overhead" },
] as const;

function JobRow({ job, orderId }: { job: PnlJobRow; orderId: string }) {
  const { saveOverrides } = usePnlMutations(orderId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const save = () => {
    const body: Record<string, number | null> = {};
    for (const { key } of OVERRIDE_FIELDS) {
      const raw = draft[key];
      if (raw === undefined) continue;
      // Blank clears the override and hands the line back to the rate
      // card. That is a different answer from 0, which means this job
      // genuinely cost nothing to finish.
      if (raw.trim() === "") { body[key] = null; continue; }
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) body[key] = n;
    }
    if (Object.keys(body).length === 0) return;
    saveOverrides.mutate(
      { jobId: job.id, body },
      { onSuccess: () => setDraft({}) }
    );
  };

  const fieldValue = (key: (typeof OVERRIDE_FIELDS)[number]["key"]) => {
    if (draft[key] !== undefined) return draft[key];
    const line = job[key];
    return line.basis === "override" ? String(line.amount) : "";
  };

  return (
    <>
      <tr className="hover:bg-ink-100/40">
        <td className="px-4 py-3">
          <Link to={`/jobs/${job.id}`} className="font-medium text-brand-600 hover:underline">
            {job.jobNo}
          </Link>
          <div className="text-xs text-ink-400">{job.status}</div>
        </td>
        <td className="px-4 py-3">
          {job.productionMode === "outsource" ? (
            <StatusChip tone="warning">
              <span className="inline-flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {job.outsourceVendor || "Outsourced"}
              </span>
            </StatusChip>
          ) : (
            <span className="text-sm text-ink-400">In-house</span>
          )}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{meters(job.producedMeters)}</td>
        <td className="px-4 py-3 text-right tabular-nums">
          {rupee(job.labour.amount)}
          <div className="text-xs text-ink-400">
            {job.labour.shifts} shift{job.labour.shifts === 1 ? "" : "s"}
            {job.labour.openShifts > 0 && ` · ${job.labour.openShifts} open`}
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{rupee(job.jobWork)}</td>
        <td className="px-4 py-3 text-right font-medium tabular-nums">{rupee(job.total)}</td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Costs"}
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="bg-ink-100/30">
          <td colSpan={7} className="px-4 py-4">
            <p className="text-sm font-medium">Actual cost for {job.jobNo}</p>
            <p className="mt-0.5 text-xs text-ink-400">
              Leave a box empty to use the rate card. A figure here replaces it —
              including 0, which means this job cost nothing at that stage.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {OVERRIDE_FIELDS.map(({ key, label }) => (
                <div key={key} className="w-36">
                  <Input
                    label={`${label} ₹`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={job[key].basis === "rate" ? `${job[key].amount} (rate)` : ""}
                    value={fieldValue(key)}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <Button
                size="sm"
                className="mb-0.5"
                loading={saveOverrides.isPending}
                disabled={Object.keys(draft).length === 0}
                onClick={save}
              >
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export function OrderPnlDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: pnl, isLoading, isError, error } = useOrderPnl(id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !pnl) {
    return <ErrorBanner message={(error as Error)?.message ?? "Could not load this P&L"} />;
  }

  return (
    <div>
      <Link
        to="/order-pnl"
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <PageHeader
        title={`Order #${pnl.order.orderNo ?? "—"} — P&L`}
        subtitle={[pnl.order.customerName, pnl.order.po].filter(Boolean).join(" · ")}
        actions={
          <>
            <a href={pnlService.pdfUrl(pnl.order.id)} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <FileText className="h-4 w-4" /> P&L statement
              </Button>
            </a>
            <Link to={`/orders/${pnl.order.id}`}>
              <Button variant="secondary" size="sm">Open order</Button>
            </Link>
          </>
        }
      />

      {/* Every missing input, named. A P&L that reports a confident
          profit built on unrecorded costs is worse than none. */}
      {pnl.warnings.length > 0 && (
        <Card className="mb-5 border-l-4 border-status-warning p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-status-warning">
            <AlertTriangle className="h-4 w-4" />
            What this figure is missing
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-600">
            {pnl.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Labelled as a region: several of these figures also appear
          inside the cards that build them, so the summary needs to be
          addressable on its own. */}
      <section
        aria-label="Order P&L summary"
        className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Card className="p-4">
          <p className="text-xs text-ink-400">Order value</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{rupee(pnl.revenue.orderValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-400">Total cost</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{rupee(pnl.costs.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-400">Profit</p>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${
              pnl.totals.marginPct == null
                ? "text-ink-400"
                : pnl.totals.profit < 0
                  ? "text-status-danger"
                  : "text-status-success"
            }`}
          >
            {rupee(pnl.totals.profit)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-400">Margin</p>
          <p className="mt-1">
            <StatusChip tone={marginTone(pnl.totals.marginPct)}>
              {marginLabel(pnl.totals.marginPct)}
            </StatusChip>
          </p>
          <p className="mt-1 text-xs text-ink-400 tabular-nums">
            {meters(pnl.totals.producedMeters)} produced
          </p>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RevenueCard pnl={pnl} />
        <CostCard pnl={pnl} />
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-base font-semibold">Jobs on this order</h2>
          <p className="mt-0.5 text-sm text-ink-400">
            Yarn is drawn against the order, not the job, so it is not split here.
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Made by</th>
                <th className="px-4 py-3 text-right font-medium">Produced</th>
                <th className="px-4 py-3 text-right font-medium">Wages</th>
                <th className="px-4 py-3 text-right font-medium">Job-work</th>
                <th className="px-4 py-3 text-right font-medium">Job cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {pnl.jobs.map((j) => (
                <JobRow key={j.id} job={j} orderId={pnl.order.id} />
              ))}
              {pnl.jobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-400">
                    No jobs raised against this order yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {pnl.materialLines.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="px-5 pt-5">
            <h2 className="text-base font-semibold">Yarn issued</h2>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th className="px-4 py-3 text-right font-medium">Price at issue</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pnl.materialLines.map((m, i) => (
                  <tr key={`${m.name}-${i}`}>
                    <td className="px-4 py-3">{m.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.quantity.toLocaleString("en-IN")} kg
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.unitPrice > 0 ? (
                        rupeePrecise(m.unitPrice)
                      ) : (
                        <span className="text-status-warning">no price</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupee(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default OrderPnlDetailPage;
