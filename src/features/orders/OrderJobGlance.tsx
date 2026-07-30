import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ExternalLink } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { OrderJobRef } from "./types";
import { jobRefId, jobRefNo, jobRefStatus } from "./orderJobRef";

const n = (v: number) => v.toLocaleString("en-IN");

/**
 * One job on the order, collapsed to a single line and expandable to show
 * the elastics it covers and how much of each is still to weave — so the
 * order page answers "what is this job actually doing" without a round
 * trip to the job page.
 *
 * The disclosure and the link are siblings rather than nested: a link
 * inside a button is invalid, and keyboard users need to reach both.
 */
export function OrderJobGlance({ job }: { job: OrderJobRef }) {
  const [open, setOpen] = useState(false);
  const jobId = jobRefId(job);
  const jobNo = jobRefNo(job);
  const status = jobRefStatus(job);
  const rows = job.elasticSummary ?? [];

  const outstanding = rows.reduce((sum, r) => sum + r.pending, 0);
  const label = `Job J-${jobNo ?? "?"}`;

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${label} — show elastics`}
          className="-mx-2 flex flex-1 items-center gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-ink-100/40"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-ink-400 transition-transform",
              open && "rotate-90"
            )}
          />
          <span className="text-sm font-medium">{label}</span>
          {status && <StatusChip tone="info">{status}</StatusChip>}
          {rows.length > 0 && (
            <span className="ml-auto text-xs text-ink-400">
              {outstanding > 0
                ? `${n(outstanding)} m to make`
                : "all made"}
            </span>
          )}
        </button>
        {jobId && (
          <Link
            to={`/jobs/${jobId}`}
            aria-label={`Open ${label}`}
            title="Open job"
            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>

      {open && (
        <div className="mb-2 ml-6 overflow-x-auto rounded-lg border border-ink-200 bg-surface-muted">
          {rows.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-ink-400">
              No elastics recorded on this job.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Elastic</th>
                  <th className="px-3 py-2 text-right font-medium">Planned</th>
                  <th className="px-3 py-2 text-right font-medium">Produced</th>
                  <th className="px-3 py-2 text-right font-medium" title="Planned minus produced">
                    Pending
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{n(r.planned)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                      {n(r.produced)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        r.pending > 0 ? "font-semibold" : "text-ink-400"
                      )}
                    >
                      {r.pending > 0 ? n(r.pending) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  );
}
