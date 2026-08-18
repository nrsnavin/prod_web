import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, AlertTriangle, Link2, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { qcService } from "./api";
import type { RootCause, RootCauseFinding, RootCauseRow } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE LOT TRAIL, POINTED BACKWARDS
//
//  What this panel prints is an accusation: a yarn lot, a machine, a
//  shift, or a person. That governs every design decision here.
//
//    • a finding always shows the counts it rests on, never a bare rate
//    • confounded findings are shown TOGETHER and neither is blamed
//    • the method is on the page, because somebody will be asked "how
//      do you know?" by the supplier whose lot has been rejected
//    • nothing here is a conclusion. It is a place to go and look.
// ══════════════════════════════════════════════════════════════════

type Window = "30" | "90" | "365";

const FACTOR_LABEL: Record<string, string> = {
  lot: "Yarn lot",
  machine: "Machine",
  operator: "Operator",
  shift: "Shift",
};

function Finding({ f, confounded }: { f: RootCauseFinding; confounded: string[] }) {
  return (
    <li className="rounded-lg border border-ink-100 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <StatusChip tone="neutral">{FACTOR_LABEL[f.factor] ?? f.factor}</StatusChip>
          <span className="font-semibold">{f.label}</span>
        </div>
        <span className="tabular-nums text-sm font-semibold text-status-danger">
          {f.lift}× the usual rate
        </span>
      </div>

      {/* The counts, always. A rate with no denominator is how three
          checks become a rejected delivery. */}
      <p className="mt-1 text-sm text-ink-500">
        Failed <span className="font-medium text-ink-900">{f.fails} of {f.checks}</span> checks
        {" "}({f.failRatePct}%) against {f.restFailRatePct}% elsewhere.
      </p>

      {confounded.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-status-warningBg/50 px-2 py-1.5 text-xs text-status-warning">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Cannot be separated from {confounded.join(" or ")} — they appear on the same
            checks. Look at both; the data does not say which.
          </span>
        </p>
      )}
    </li>
  );
}

function FactorTable({ rows }: { rows: RootCauseRow[] }) {
  if (rows.length === 0) return <p className="py-2 text-sm text-ink-400">Nothing recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="pb-2 pr-4 font-medium">Value</th>
            <th className="pb-2 pr-4 font-medium">Checks</th>
            <th className="pb-2 pr-4 font-medium">Failed</th>
            <th className="pb-2 font-medium">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.factor}-${r.key}`} className="border-t border-ink-100">
              <td className="py-2 pr-4">{r.label}</td>
              <td className="py-2 pr-4 tabular-nums text-ink-500">{r.checks}</td>
              <td className="py-2 pr-4 tabular-nums text-ink-500">{r.fails}</td>
              <td className="py-2 tabular-nums">{r.failRatePct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Body({ data }: { data: RootCause }) {
  const [openFactor, setOpenFactor] = useState<string | null>(null);

  // Which findings this one cannot be told apart from.
  const partnersOf = (f: RootCauseFinding) =>
    data.confounders
      .filter((c) =>
        (c.a.factor === f.factor && c.a.label === f.label) ||
        (c.b.factor === f.factor && c.b.label === f.label))
      .map((c) => {
        const other = c.a.factor === f.factor && c.a.label === f.label ? c.b : c.a;
        return `${(FACTOR_LABEL[other.factor] ?? other.factor).toLowerCase()} ${other.label}`;
      });

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="tabular-nums">
          <span className="text-2xl font-bold">{data.totals.checks}</span>
          <span className="ml-2 text-ink-400">checks</span>
        </span>
        <span className="tabular-nums">
          <span className="text-2xl font-bold text-status-danger">{data.totals.fails}</span>
          <span className="ml-2 text-ink-400">
            failed{data.totals.failRatePct != null ? ` (${data.totals.failRatePct}%)` : ""}
          </span>
        </span>
        {data.totals.rejectedMeters > 0 && (
          <span className="text-ink-500 tabular-nums">
            {data.totals.rejectedMeters.toLocaleString("en-IN")} m rejected
          </span>
        )}
      </div>

      {data.narrative && (
        <div className="mt-3 whitespace-pre-line rounded-lg bg-brand-50 p-3 text-sm text-ink-700">
          {data.narrative}
        </div>
      )}

      {data.findings.length === 0 ? (
        // The most important empty state in the app. "Nothing stands out"
        // is a real, useful answer — and a report that names a culprit
        // every week regardless is worse than no report.
        <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-ink-500">
          {data.note ?? "Nothing stands out."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.findings.map((f) => (
            <Finding key={`${f.factor}-${f.key}`} f={f} confounded={partnersOf(f)} />
          ))}
        </ul>
      )}

      {/* Everything measured, not just what was flagged. A lot with three
          checks is kept out of the findings but stays visible here. */}
      <div className="mt-4 border-t border-ink-100 pt-3">
        {Object.entries(data.factors).map(([key, rows]) => (
          <div key={key}>
            <button
              onClick={() => setOpenFactor(openFactor === key ? null : key)}
              className="flex w-full items-center gap-1.5 py-1.5 text-left text-sm font-medium text-ink-600 hover:text-ink-900"
            >
              {openFactor === key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              All by {FACTOR_LABEL[key]?.toLowerCase() ?? key}
              <span className="text-xs font-normal text-ink-400">({rows.length})</span>
            </button>
            {openFactor === key && <div className="pb-2 pl-5"><FactorTable rows={rows} /></div>}
          </div>
        ))}
      </div>

      {data.method && (
        // On the page on purpose. Somebody is going to be asked "how do
        // you know?" by a supplier whose lot has just been rejected.
        <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-400">
          {data.method.test}, {data.method.correction}. A factor needs at least{" "}
          {data.method.minSamples} checks before it can be reported as a finding.
        </p>
      )}
    </>
  );
}

export function RootCausePanel() {
  const [days, setDays] = useState<Window>("90");

  const { data, isLoading } = useQuery({
    queryKey: ["qc-root-cause", days],
    queryFn: () => qcService.rootCause(Number(days)),
    staleTime: 60_000,
  });

  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
            <Search className="h-4 w-4" /> What is causing the failures
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-400">
            QC failures attributed back along the lot trail — to yarn lots, machines,
            operators and shifts. Somewhere to look, not a conclusion.
          </p>
        </div>
        <FilterChips<Window>
          options={[
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "365", label: "12 months" },
          ]}
          value={days}
          onChange={setDays}
        />
      </div>

      {isLoading ? <Skeleton className="mt-4 h-40 w-full" /> : data ? <Body data={data} /> : null}

      {data && data.findings.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          These are correlations over past checks. Confirm on the floor before acting on
          one — particularly where a person is named.
        </p>
      )}
    </Card>
  );
}

export default RootCausePanel;
