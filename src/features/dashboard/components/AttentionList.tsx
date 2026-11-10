import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import type { AttentionItem } from "../api";

// ══════════════════════════════════════════════════════════════════
//  WHAT NEEDS YOU
//
//  The first thing the home screen says, in one list: orders late or
//  forecast late, shifts to verify, approvals, overdue money, invoices
//  waiting for an IRN, late supplier deliveries, materials below their
//  minimum. Each line says how many, shows up to three examples you can
//  open, and links to the screen that clears it.
//
//  A screen the person can't open is never linked: the line still says
//  what is waiting, so a supervisor knows an order is at risk even if
//  the order book is someone else's.
// ══════════════════════════════════════════════════════════════════

/** The words on each line's link: what you go there to do. */
const ACTION: Record<string, string> = {
  ordersAtRisk: "Review",
  shiftsToVerify: "Verify",
  overdueInvoices: "Chase",
  billsDue: "Pay",
  expensesToApprove: "Approve",
  advancesRequested: "Decide",
  pendingLeaves: "Decide",
  irnPending: "Register",
  latePos: "Chase",
  lowStock: "Reorder",
};

export function AttentionList({
  items,
  loading,
  canOpen,
}: {
  items: AttentionItem[] | undefined;
  loading: boolean;
  /** Whether the person can open a path; unlinked otherwise. */
  canOpen: (path: string) => boolean;
}) {
  const total = (items ?? []).reduce((s, a) => s + a.count, 0);
  return (
    <Card className="p-5" aria-labelledby="needs-you">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="needs-you" className="font-semibold">Needs you</h2>
        {!loading && items && items.length > 0 && (
          <span className="text-sm text-ink-500 tabular-nums">{total.toLocaleString("en-IN")} waiting</span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
            </div>
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-600">
          <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden />
          Nothing is waiting on you.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {items.map((a) => {
            const Icon = a.tone === "danger" ? CircleAlert : AlertTriangle;
            const linked = canOpen(a.to);
            return (
              <li key={a.key} className="flex items-start gap-3 py-3" aria-label={`${a.label}: ${a.count}`}>
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    a.tone === "danger" ? "bg-status-dangerBg text-status-danger" : "bg-status-warningBg text-status-warning"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-ink-900">{a.label}</span>
                    <span className={cn("font-semibold tabular-nums", a.tone === "danger" ? "text-status-danger" : "text-status-warning")}>
                      {a.count.toLocaleString("en-IN")}
                    </span>
                    {a.summary && <span className="text-ink-500">· {a.summary}</span>}
                  </p>
                  {a.items.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {a.items.map((x, i) => (
                        <li key={i} className="break-words text-ink-600 sm:truncate">
                          {canOpen(x.to) ? (
                            <Link to={x.to} className="font-medium text-ink-900 hover:text-brand-600 hover:underline">
                              {x.title}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink-900">{x.title}</span>
                          )}
                          <span className="text-ink-500"> · {x.detail}</span>
                        </li>
                      ))}
                      {a.count > a.items.length && (
                        <li className="text-xs text-ink-400">and {a.count - a.items.length} more</li>
                      )}
                    </ul>
                  )}
                </div>
                {linked && (
                  <Link
                    to={a.to}
                    className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:underline"
                    aria-label={`${ACTION[a.key] ?? "Open"}: ${a.label}`}
                  >
                    {ACTION[a.key] ?? "Open"}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
