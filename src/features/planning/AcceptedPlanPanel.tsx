import { useState } from "react";
import { CheckCircle2, ChevronDown, PencilLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import type { AcceptedPlan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE PLAN OF RECORD, ACTUALLY LEGIBLE
//
//  This was a one-line banner: "Plan of record accepted <date> by
//  <who> · 14 assignments". Every word of that is about the acceptance
//  and none of it about the plan. The thing the shop floor is supposed
//  to be following could not be read anywhere in the application.
//
//  ── Grouped by machine, because that is who reads it ─────────────
//  A flat list of assignments is a database table. The person who needs
//  this is standing at a loom asking what runs next on THIS loom, so
//  the loom is the heading and the queue under it is in the order it
//  will be run.
//
//  ── It says when a human overruled the planner ───────────────────
//  An accepted plan that was edited first is a different object from
//  one taken as offered, and the difference is the most informative
//  thing on the screen. It is marked, with both plans' costs, so
//  "we overrode the planner and it worked out" is a question somebody
//  can answer in three months instead of argue about.
// ══════════════════════════════════════════════════════════════════

function Terms({ label, terms }: { label: string; terms?: { late: number; changeover: number; balance: number } }) {
  if (!terms) return null;
  return (
    <span className="text-ink-500">
      {label}{" "}
      <span className="tabular-nums text-ink-900">
        {Math.round(terms.late)}d late · {terms.changeover} changeover
        {terms.changeover === 1 ? "" : "s"} · {terms.balance.toFixed(1)} imbalance
      </span>
    </span>
  );
}

export function AcceptedPlanPanel({ plan }: { plan: AcceptedPlan }) {
  const [open, setOpen] = useState(false);

  // Group by loom, preserving each queue's running order.
  const byMachine = new Map<string, AcceptedPlan["assignments"]>();
  for (const a of plan.assignments) {
    const key = a.machineID || "—";
    if (!byMachine.has(key)) byMachine.set(key, []);
    byMachine.get(key)!.push(a);
  }
  for (const rows of byMachine.values()) {
    rows.sort((x, y) => (x.sequence ?? 0) - (y.sequence ?? 0));
  }

  const lateCount = plan.assignments.filter((a) => a.late).length;

  return (
    <Card className="mb-4 border-l-4 border-status-success">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left text-sm"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
        <span>
          Plan of record accepted{" "}
          <span className="font-medium">
            {new Date(plan.acceptedAt).toLocaleString("en-IN")}
          </span>{" "}
          by {plan.acceptedBy || "admin"}
        </span>
        <span className="text-ink-400 tabular-nums">
          {plan.assignments.length} run{plan.assignments.length === 1 ? "" : "s"}
          {" on "}{byMachine.size} machine{byMachine.size === 1 ? "" : "s"}
          {lateCount > 0 && ` · ${lateCount} late`}
        </span>
        {plan.edited && (
          <span
            className="inline-flex items-center gap-1 rounded bg-status-warningBg/50 px-1.5 py-0.5 text-[11px] text-status-warning"
            title="A person changed this before accepting it"
          >
            <PencilLine className="h-3 w-3" /> edited before accepting
          </span>
        )}
        <ChevronDown
          className={cn("ml-auto h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-ink-100 p-3">
          {plan.edited && (
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <Terms label="Planner offered" terms={plan.proposedTerms} />
              <Terms label="Accepted" terms={plan.objectiveTerms} />
            </div>
          )}

          <div className="space-y-3">
            {[...byMachine.entries()].map(([machineID, rows]) => (
              <div key={machineID}>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {machineID}
                  <span className="ml-2 font-normal normal-case tracking-normal">
                    {rows.length} run{rows.length === 1 ? "" : "s"}
                  </span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-ink-400">
                        <th className="pb-1 pr-3 text-left font-medium">#</th>
                        <th className="pb-1 pr-3 text-left font-medium">Elastic</th>
                        <th className="pb-1 pr-3 text-left font-medium">Order</th>
                        <th className="pb-1 pr-3 text-right font-medium">Metres</th>
                        <th className="pb-1 pr-3 text-right font-medium">Days</th>
                        <th className="pb-1 pr-3 text-left font-medium">Finishes</th>
                        <th className="pb-1 text-left font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a, i) => (
                        <tr key={`${a.orderNo}-${a.elasticName}-${i}`} className="border-t border-ink-100">
                          <td className="py-1.5 pr-3 tabular-nums text-ink-400">{i + 1}</td>
                          <td className="py-1.5 pr-3">
                            {a.elasticName}
                            {a.changeover && (
                              <span className="ml-1.5 text-[11px] text-ink-400">(changeover)</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-ink-500">
                            #{a.orderNo} {a.customer}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">
                            {Math.round(a.qtyMeters).toLocaleString("en-IN")}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{a.weavingDays}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{a.projectedFinish ?? "—"}</td>
                          <td className="py-1.5 tabular-nums">
                            {a.dueDate ?? "—"}{" "}
                            {a.late && (
                              <StatusChip tone="danger">
                                {a.lateWorkingDays}d late
                              </StatusChip>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default AcceptedPlanPanel;
