import { useMemo, useState } from "react";
import { usePrefillElastics } from "@/features/elastics/prefill";
import { useNavigate } from "react-router-dom";
import { Plus, FileUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useCreditHold } from "@/features/customers/credit";
import { ApiError } from "@/core/http/httpClient";
import { useOrders, useOrderMutations } from "./hooks";
import { ORDER_FILTERS, OrderFilter, OrderListItem } from "./types";
import { orderStatusTone, orderStatusLabel, orderFilterLabel } from "./orderStatus";
import { OrderForm } from "./OrderForm";
import { PoIntakeModal } from "./PoIntakeModal";
import { OrderBulkActions } from "./OrderBulkActions";
import { WhatsAppOrders, draftOf, useOrderRequestDecision, type OrderRequest } from "./WhatsAppOrders";
import { formatDate } from "@/core/format/date";
import { rupees } from "@/core/format/money";
import { useUrlFlag, useUrlState } from "@/core/hooks/useUrlState";
import { SavedViews, type ListView } from "@/components/ui/SavedViews";

// ══════════════════════════════════════════════════════════════════
//  THE ORDER BOOK
//
//  It carried names and dates and nothing to weigh an order by. Each
//  row now says how far along it is (metres made of metres ordered),
//  what it is worth at the agreed rates, and how long is left before its
//  supply date, or how late it is. The foot of the table totals what is
//  shown. The filter, and whether only late orders show, live in the
//  address, so a refresh or a shared link keeps them.
// ══════════════════════════════════════════════════════════════════

const DAY = 86_400_000;
const LIVE = new Set(["Open", "Approved", "InProgress"]);
const qty = (xs?: Array<{ quantity?: number }>) => (xs ?? []).reduce((s, x) => s + (x.quantity ?? 0), 0);
const valueOf = (o: OrderListItem) => (o.elasticOrdered ?? []).reduce((s, x) => s + (x.quantity ?? 0) * (x.rate ?? 0), 0);
const priced = (o: OrderListItem) => (o.elasticOrdered ?? []).some((x) => (x.rate ?? 0) > 0);
const metres = (n: number) => Math.round(n).toLocaleString("en-IN");
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Days from today to the supply date: negative when it has passed. */
export const daysToSupply = (iso: string, now = new Date()) => Math.round((dayOf(new Date(iso)) - dayOf(now)) / DAY);
export const isLate = (o: OrderListItem, now = new Date()) => LIVE.has(o.status) && !!o.supplyDate && daysToSupply(o.supplyDate, now) < 0;

const columns: Column<OrderListItem>[] = [
  {
    key: "no",
    header: "Order",
    sort: (o) => o.orderNo,
    render: (o) => (
      <span>
        <span className="font-medium">#{o.orderNo}</span>
        {o.po && <span className="block text-xs text-ink-400">{o.po}</span>}
      </span>
    ),
  },
  { key: "customer", header: "Customer", sort: (o) => o.customer?.name ?? "", render: (o) => o.customer?.name ?? "—" },
  {
    key: "supply",
    header: "Supply by",
    sort: (o) => (o.supplyDate ? new Date(o.supplyDate).getTime() : Number.MAX_SAFE_INTEGER),
    render: (o) => {
      if (!o.supplyDate) return "—";
      const d = daysToSupply(o.supplyDate);
      return (
        <span>
          {formatDate(o.supplyDate)}
          {LIVE.has(o.status) && (
            <span className={cn("block text-xs", d < 0 ? "font-medium text-status-danger" : d <= 3 ? "text-status-warning" : "text-ink-400")}>
              {d < 0 ? `${-d} day${d === -1 ? "" : "s"} late` : d === 0 ? "due today" : `in ${d} day${d === 1 ? "" : "s"}`}
            </span>
          )}
        </span>
      );
    },
  },
  {
    key: "made",
    header: "Made / ordered",
    align: "right",
    sort: (o) => { const t = qty(o.elasticOrdered); return t ? qty(o.producedElastic) / t : 0; },
    render: (o) => {
      const ordered = qty(o.elasticOrdered);
      const made = qty(o.producedElastic);
      const pct = ordered ? Math.min(100, Math.round((made / ordered) * 100)) : 0;
      return (
        <span className="inline-block min-w-[8.5rem]">
          {metres(made)} / {metres(ordered)} m
          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </span>
        </span>
      );
    },
    total: (rows) => `${metres(rows.reduce((s, o) => s + qty(o.producedElastic), 0))} / ${metres(rows.reduce((s, o) => s + qty(o.elasticOrdered), 0))} m`,
  },
  {
    key: "value",
    header: "Value",
    align: "right",
    sort: valueOf,
    render: (o) => (priced(o) ? rupees(valueOf(o)) : <span className="text-ink-400">Not priced</span>),
    total: (rows) => rupees(rows.reduce((s, o) => s + valueOf(o), 0)),
  },
  {
    key: "status",
    header: "Status",
    render: (o) => (
      <StatusChip tone={orderStatusTone[o.status]}>{orderStatusLabel[o.status]}</StatusChip>
    ),
  },
  { key: "date", header: "Order date", defaultHidden: true, sort: (o) => (o.date ? new Date(o.date).getTime() : 0), render: (o) => (o.date ? formatDate(o.date) : "—") },
];

const VIEWS: ListView[] = [
  { name: "All orders", params: {} },
  { name: "Waiting for approval", params: { status: "Open" } },
  { name: "In production", params: { status: "InProgress" } },
  { name: "Late", params: { late: "1" } },
];

export function OrderListPage() {
  const [status, setStatus] = useUrlState<OrderFilter>("status", "All", ORDER_FILTERS);
  const [lateOnly, setLateOnly] = useUrlFlag("late");
  const [createOpen, setCreateOpen] = useState(false);
  // Arrived from the elastic list with a selection: open New order with it.
  const { prefill, clear: clearPrefill } = usePrefillElastics(() => setCreateOpen(true));
  // Opened from a WhatsApp order: the form starts from it, and saving marks it done.
  const [fromRequest, setFromRequest] = useState<OrderRequest | null>(null);
  const decideRequest = useOrderRequestDecision();
  const closeCreate = () => { setCreateOpen(false); clearPrefill(); setFromRequest(null); };
  const [intakeOpen, setIntakeOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    orders, total, isLoading, isError, error,
    hasNextPage, fetchNextPage, isFetchingNextPage,
  } = useOrders(status);
  const { create } = useOrderMutations();
  const hold = useCreditHold("this order");

  // Ticked orders, kept with their rows so a selection survives a change
  // of filter; the bar sees the latest copy of each row on screen.
  const [picked, setPicked] = useState<Map<string, OrderListItem>>(new Map());
  const pickedIds = useMemo(() => new Set(picked.keys()), [picked]);
  const onPick = (next: Set<string>) => {
    const shown = new Map(orders.map((o) => [o._id, o]));
    setPicked((prev) => {
      const m = new Map<string, OrderListItem>();
      for (const id of next) {
        const row = shown.get(id) ?? prev.get(id);
        if (row) m.set(id, row);
      }
      return m;
    });
  };
  const selectedRows = useMemo(() => {
    const shown = new Map(orders.map((o) => [o._id, o]));
    return [...picked.values()].map((o) => shown.get(o._id) ?? o);
  }, [picked, orders]);

  const scope = `${lateOnly ? "late " : ""}${status === "All" ? "" : `${orderFilterLabel[status].toLowerCase()} `}`;
  const rows = useMemo(() => (lateOnly ? orders.filter((o) => isLate(o)) : orders), [orders, lateOnly]);

  return (
    <>
      <PageHeader
        title="Orders"
        // Honest about truncation: the endpoint is paged, so say how many
        // of the matching orders are actually on screen.
        subtitle={
          isLoading
            ? undefined
            : orders.length < total
              ? `${orders.length} of ${total} ${scope}orders`
              : `${total} ${scope}orders`
        }
        actions={
          <>
            {/* Secondary on purpose: typing the order is still the
                normal path, and reading a document is the shortcut. */}
            <Button variant="secondary" onClick={() => setIntakeOpen(true)}>
              <FileUp className="h-4 w-4" /> Read a customer PO
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New order
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SavedViews tableId="orders" views={VIEWS} keys={["status", "late"]} />
        <FilterChips
          options={ORDER_FILTERS.map((s) => ({ value: s, label: orderFilterLabel[s] }))}
          value={status}
          onChange={(v) => setStatus(v)}
        />
        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} />
          Only late
        </label>
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <WhatsAppOrders onOpen={(r) => { setFromRequest(r); setCreateOpen(true); }} />

      {picked.size > 0 && <OrderBulkActions selected={selectedRows} onClear={() => setPicked(new Map())} />}

      <Card>
        <DataTable
          selection={{ selected: pickedIds, onChange: onPick, label: (o) => `Select order ${o.orderNo}` }}
          columns={columns}
          rows={rows}
          rowKey={(o) => o._id}
          onRowClick={(o) => navigate(`/orders/${o._id}`)}
          loading={isLoading}
          emptyTitle={`No ${scope}orders`}
          tableId="orders"
          totalLabel={`${rows.length} order${rows.length === 1 ? "" : "s"} shown`}
        />
        {hasNextPage && (
          <div className="border-t border-ink-100 p-3 text-center">
            <Button
              variant="secondary"
              loading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              Load more ({total - orders.length} remaining)
            </Button>
          </div>
        )}
      </Card>

      {intakeOpen && <PoIntakeModal onClose={() => setIntakeOpen(false)} />}

      <FormScreen open={createOpen} onClose={closeCreate} title="New order" width="max-w-2xl">
        <OrderForm
          key={fromRequest?._id ?? "new"}
          prefillElastics={prefill}
          draft={fromRequest ? draftOf(fromRequest) : null}
          submitting={create.isPending}
          onCancel={() => closeCreate()}
          onSubmit={(values) =>
            hold.run((creditOverride) => create.mutate({ ...values, creditOverride }, {
              onSuccess: (orderId) => {
                if (fromRequest) decideRequest.mutate({ id: fromRequest._id, action: "converted", order: orderId });
                closeCreate();
                toast("Order created", "success");
                navigate(`/orders/${orderId}`);
              },
              onError: (e) => {
                if (!hold.onError(e)) toast(e instanceof ApiError ? e.message : "Failed to create order", "error");
              },
            }))
          }
        />
        {hold.dialog}
      </FormScreen>
    </>
  );
}
