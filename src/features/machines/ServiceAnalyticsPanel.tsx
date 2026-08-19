import { useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee, Info, ShieldQuestion } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useToast } from "@/components/ui/Toast";
import { lazyChart } from "@/components/ui/LazyChart";
import { toApiError } from "@/core/http/httpClient";
import { useServiceAnalytics, useMachineMutations } from "./hooks";
import { ServiceFinding } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHAT SERVICING COSTS, AND WHAT IS WORTH A LOOK
//
//  ── The wording is the feature ───────────────────────────────────
//  This panel shows patterns in service billing. It does not show
//  fraud, and the word does not appear on it. Every finding is
//  printed with the innocent explanation beside it, because that
//  explanation is usually the true one and because the alternative is
//  a screen that quietly accuses a named technician on the strength of
//  a median.
//
//  If somebody is stealing, the thing that catches them is a person
//  reading the evidence — not this panel deciding. So the design gives
//  them the evidence and gets out of the way.
//
//  ── Typical, not average ─────────────────────────────────────────
//  The headline monthly figure is a MEDIAN month. One gearbox rebuild
//  in a quiet year makes the mean a number nobody should budget
//  against, and the mean is shown beside it so the gap between the two
//  is itself visible.
// ══════════════════════════════════════════════════════════════════

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "2026-08" → "Aug 26" */
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const date = new Date(Number(y), Number(mo) - 1, 1);
  return `${date.toLocaleString("en-IN", { month: "short" })} ${y.slice(2)}`;
};

const SpendChart = lazyChart<{
  series: Array<Record<string, unknown>>;
  dataKey: string;
  colorIndex?: 0 | 1 | 2 | 3;
  format: (v: number) => string;
}>(() => import("@/features/reports/components/ReportBarChart"), "ReportBarChart", "h-60");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-200 p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/** How loud a finding is drawn. Ranking only — not a probability. */
function severityTone(severity: number): { label: string; className: string } {
  if (severity >= 0.7) return { label: "Look first", className: "bg-status-dangerBg text-status-danger" };
  if (severity >= 0.4) return { label: "Worth a look", className: "bg-status-warningBg text-status-warning" };
  return { label: "Minor", className: "bg-ink-100 text-ink-600" };
}

function Finding({
  finding, onDismiss,
}: {
  finding: ServiceFinding;
  onDismiss: (f: ServiceFinding) => void;
}) {
  const [open, setOpen] = useState(false);
  const tone = severityTone(finding.severity);

  return (
    <li className="rounded-lg border border-ink-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone.className}`}>
              {tone.label}
            </span>
            <h4 className="font-semibold text-ink-900">{finding.title}</h4>
          </div>
          <p className="mt-1 text-sm text-ink-600">{finding.detail}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : `Evidence (${finding.evidence.length})`}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDismiss(finding)}>
            Not a problem
          </Button>
        </div>
      </div>

      {/* Never optional, never collapsed. A pattern shown without the
          ordinary explanation for it reads as an accusation. */}
      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-status-infoBg px-3 py-2 text-xs text-status-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{finding.innocent}</span>
      </p>

      {open && (
        <TableScroll className="mt-3">
          <table className="w-full text-xs">
            <thead className="border-b border-ink-100 text-left text-ink-400">
              <tr>
                {Object.keys(finding.evidence[0] ?? {}).map((k) => (
                  <th key={k} className="px-2 py-1 font-medium">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {finding.evidence.map((row, i) => (
                <tr key={i}>
                  {Object.entries(row).map(([k, v]) => (
                    <td key={k} className="px-2 py-1 tabular-nums text-ink-600">
                      {v == null
                        ? "—"
                        : /date/i.test(k)
                          ? new Date(String(v)).toLocaleDateString("en-IN")
                          : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </li>
  );
}

export function ServiceAnalyticsPanel({ days = 365 }: { days?: number }) {
  const { data, isLoading, isError, error, refetch } = useServiceAnalytics(days);
  const { dismissFinding } = useMachineMutations();
  const { toast } = useToast();
  const [dismissing, setDismissing] = useState<ServiceFinding | null>(null);

  if (isLoading) {
    return <Card className="p-5"><Skeleton className="h-64 w-full" /></Card>;
  }
  if (isError) {
    return (
      <Card className="p-5">
        <ErrorState error={error} what="service analytics" onRetry={() => refetch()} />
      </Card>
    );
  }
  if (!data) return null;

  const { spend, anomalies, costliest } = data;

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            <IndianRupee className="h-4 w-4" /> Service spending
          </h2>
          <span className="text-xs text-ink-400">
            {spend.services} services over the last {Math.round(days / 30)} months
          </span>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Spent in total" value={rupees(spend.total)} />
          <Stat
            label="Typical month"
            value={rupees(spend.typicalMonth)}
            // Shown together on purpose: where they diverge, one big
            // month is carrying the average.
            hint={`mean ${rupees(spend.meanMonth)}`}
          />
          <Stat label="Services" value={String(spend.services)} />
          <Stat
            label="Most on"
            value={spend.byType[0]?.type ?? "—"}
            hint={spend.byType[0] ? rupees(spend.byType[0].amount) : undefined}
          />
        </div>

        {spend.total === 0 ? (
          <EmptyState
            title="No service spending recorded"
            description="Costs and bills logged against a service appear here."
          />
        ) : (
          <SpendChart
            series={spend.series.map((m) => ({ ...m, date: monthLabel(m.month) }))}
            dataKey="total"
            colorIndex={2}
            format={(v) => rupees(v)}
          />
        )}

        {costliest.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-ink-900">
              Costliest machines to keep running
            </h3>
            <TableScroll>
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 text-left text-xs text-ink-400">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Machine</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Spent</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Services</th>
                    <th className="py-1.5 text-right font-medium">Per service</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {costliest.map((m) => (
                    <tr key={m.machineId}>
                      <td className="py-1.5 pr-3">
                        <Link to={`/machines/${m.machineId}`} className="text-brand-600 hover:underline">
                          {m.machineID}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{rupees(m.total)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{m.services}</td>
                      <td className="py-1.5 text-right tabular-nums text-ink-500">
                        {rupees(m.perService)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <div className="mb-1 flex items-center gap-2">
          <ShieldQuestion className="h-4 w-4 text-ink-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
            Patterns worth checking
          </h2>
        </div>
        {/* Said once, plainly, at the top. Not a disclaimer — it is what
            the panel is. */}
        <p className="mb-4 max-w-3xl text-xs text-ink-400">
          Billing patterns that stand out against this plant's own history. Each
          one has an ordinary explanation that is usually the right one, printed
          beside it. Nothing here is evidence of anything — it is a list of
          places to look.
        </p>

        {!anomalies.ready ? (
          <EmptyState
            title="Not enough service history yet"
            description={anomalies.reason}
          />
        ) : anomalies.findings.length === 0 ? (
          <EmptyState
            title="Nothing stands out"
            description={
              `${anomalies.services} services checked` +
              (anomalies.dismissed
                ? `, ${anomalies.dismissed} previously marked as fine.`
                : ".")
            }
          />
        ) : (
          <ul className="space-y-3">
            {anomalies.findings.map((f) => (
              <Finding
                key={`${f.kind}|${f.subject}`}
                finding={f}
                onDismiss={setDismissing}
              />
            ))}
          </ul>
        )}
      </Card>

      <ReasonDialog
        open={!!dismissing}
        onClose={() => setDismissing(null)}
        title="Why is this not a problem?"
        description={
          "This stops the pattern being raised for a while. The reason is the " +
          "only record of the judgement, so write it for somebody reading it " +
          "in six months."
        }
        confirmLabel="Mark as fine"
        // Matches what the route enforces. A dialog that accepts a
        // reason the server then rejects is a refusal after the fact.
        minLength={5}
        onConfirm={async (reason) => {
          if (!dismissing) return;
          try {
            await dismissFinding.mutateAsync({
              kind: dismissing.kind, subject: dismissing.subject, reason,
            });
            setDismissing(null);
            toast("Noted — it will not be raised again for now", "success");
          } catch (err) {
            toast(toApiError(err).message, "error");
          }
        }}
      />
    </>
  );
}

export default ServiceAnalyticsPanel;
