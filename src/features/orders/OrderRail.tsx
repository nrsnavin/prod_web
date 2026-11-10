import { ProgressRail, settle, type RailStep } from "@/components/ui/ProgressRail";
import { metres, rupees } from "@/core/format/money";
import { useOrderInvoices } from "@/features/invoices/hooks";
import { owed } from "@/features/invoices/invoiceStatus";
import type { OrderInvoices } from "@/features/invoices/types";
import { jobRefStatus } from "./orderJobRef";
import type { OrderDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  AN ORDER, FROM APPROVAL TO PAYMENT
//
//  Approved → on the looms → produced → packed → dispatched → invoiced
//  → paid. Each step reads off the order's own figures: the metres
//  planned into jobs, made, packed and sent, and the invoices raised
//  against the challans and what has come in against them.
//
//  A completed order can have been closed short; the steps it never
//  reached are shown as skipped, with how far it got, and the money
//  steps still run on: a closed order is often still waiting to be
//  billed or paid.
// ══════════════════════════════════════════════════════════════════

type Money = Partial<Pick<OrderInvoices, "invoices" | "uninvoicedDcs" | "totals">>;

const sum = (order: Pick<OrderDetail, "elastics">, k: "ordered" | "produced" | "packed" | "delivered" | "notAssigned") =>
  (order.elastics ?? []).reduce((s, e) => s + (Number(e[k]) || 0), 0);

export function orderSteps(order: Pick<OrderDetail, "status" | "elastics" | "jobs">, money?: Money | null): RailStep[] {
  const closed = order.status === "Completed";
  const ordered = sum(order, "ordered");
  const produced = sum(order, "produced");
  const packed = sum(order, "packed");
  const delivered = sum(order, "delivered");
  const unplanned = Math.max(0, sum(order, "notAssigned"));
  const jobs = (order.jobs ?? []).filter((j) => (jobRefStatus(j) ?? "").toLowerCase() !== "cancelled").length;
  const of = (n: number) => `${metres(n)} of ${metres(ordered)}`.replace(" m of", " of");
  const reached = (n: number) => ordered > 0 && n >= ordered;

  const planned = jobs > 0 && unplanned === 0;
  const dispatched = reached(delivered);
  const steps: Parameters<typeof settle>[0] = [
    { key: "approved", label: "Approved", done: order.status !== "Open", detail: order.status === "Open" ? "Waiting for approval" : undefined },
    {
      key: "looms",
      label: "On the looms",
      done: planned,
      skipped: closed,
      detail: jobs === 0 ? "No jobs yet" : unplanned > 0 ? `${metres(unplanned)} not in a job` : `${jobs} job${jobs === 1 ? "" : "s"}`,
    },
    { key: "produced", label: "Produced", done: reached(produced), skipped: closed, detail: of(produced) },
    { key: "packed", label: "Packed", done: reached(packed), skipped: closed, detail: of(packed) },
    { key: "dispatched", label: "Dispatched", done: dispatched, skipped: closed, detail: of(delivered) },
  ];

  // The money steps only for someone who may see the invoices: the
  // card below says nothing to a production login either.
  if (money && Array.isArray(money.invoices)) {
    const live = money.invoices.filter((i) => i.status === "issued");
    const waiting = money.uninvoicedDcs?.length ?? 0;
    const invoicedValue = money.totals?.invoiced ?? live.reduce((s, i) => s + (i.totals?.grand ?? 0), 0);
    const due = live.reduce((s, i) => s + owed(i), 0);
    // Everything that left is billed, and nothing more will leave.
    const billed = live.length > 0 && waiting === 0 && (dispatched || closed);
    steps.push(
      {
        key: "invoiced",
        label: "Invoiced",
        done: billed,
        detail:
          live.length === 0
            ? "Nothing invoiced yet"
            : waiting > 0
              ? `${rupees(invoicedValue)} · ${waiting} challan${waiting === 1 ? "" : "s"} to invoice`
              : rupees(invoicedValue),
      },
      {
        key: "paid",
        label: "Paid",
        // Within a rupee: what rounding on a receipt leaves behind.
        done: billed && due < 1,
        detail: live.length === 0 ? undefined : due < 1 ? "Paid in full" : `${rupees(due)} owed`,
      }
    );
  }
  return settle(steps);
}

export function OrderRail({ order }: { order: OrderDetail }) {
  const money = useOrderInvoices(order._id);
  if (order.status === "Cancelled") return null;
  return <ProgressRail label="Order progress" steps={orderSteps(order, money.data ?? null)} className="mb-4" />;
}
