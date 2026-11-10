import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, IndianRupee, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useCostSettings, usePnlOrders } from "./hooks";
import { RateCardPanel } from "./RateCardPanel";
import { marginLabel, marginTone, meters, rupee } from "./format";
import type { PnlSort } from "./types";
import { StatTile as UiStatTile } from "@/components/ui/StatTile";

const SORTS: Array<{ value: PnlSort; label: string }> = [
  { value: "recent", label: "Newest first" },
  { value: "margin", label: "Best margin" },
  { value: "profit", label: "Most profit" },
  { value: "value", label: "Largest order" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "Open", label: "Open" },
  { value: "Approved", label: "Approved" },
  { value: "InProgress", label: "In progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

const LIMIT = 25;

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <UiStatTile label={label} value={value} toneClass={tone} />;
}

export function OrderPnlPage() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<PnlSort>("recent");
  const [status, setStatus] = useState("");

  const { data, isLoading, isError, error } = usePnlOrders({
    page,
    limit: LIMIT,
    sort,
    ...(status ? { status } : {}),
  });

  const rows = data?.rows ?? [];
  // The rate card is set once and changed rarely: it opens beside the
  // profits instead of sitting above them. While nothing is set, the page
  // says so, because every margin on it then reads too high.
  const [ratesOpen, setRatesOpen] = useState(false);
  const rates = useCostSettings();
  const unset = rates.data && !rates.data.configured;

  return (
    <div>
      <PageHeader
        title="Order P&L"
        subtitle="What each order earned, against the yarn, wages, job-work and conversion cost behind it."
        actions={
          <Button variant="secondary" onClick={() => setRatesOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" /> Rate card
          </Button>
        }
      />

      <SidePanel open={ratesOpen} onClose={() => setRatesOpen(false)} title="Conversion rate card" width="max-w-xl">
        <RateCardPanel bare />
      </SidePanel>

      <div className="space-y-5">
        {unset && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-status-warningBg px-4 py-3 text-sm text-status-warning">
            <p>
              <AlertTriangle className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden />
              No conversion rates are set, so finishing, checking, packing and overhead cost ₹0 here: every margin below reads higher than the real one.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setRatesOpen(true)}>Set the rate card…</Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select
              label="Rank by"
              options={SORTS}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as PnlSort);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Select
              label="Status"
              options={STATUSES}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {/* The server ranks the page it fetched, not the whole book —
              say so, rather than letting "Best margin" imply otherwise. */}
          {data && data.sortScope === "page" && data.pages > 1 && (
            <p className="pb-2.5 text-xs text-ink-400">
              Ranked within this page of {LIMIT}.
            </p>
          )}
        </div>

        {isError && <ErrorBanner message={(error as Error)?.message ?? "Could not load the P&L"} />}

        {data && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label="Order value (this page)" value={rupee(data.totals.orderValue)} />
            <Tile label="Cost (this page)" value={rupee(data.totals.cost)} />
            <Tile
              label="Profit (this page)"
              value={rupee(data.totals.profit)}
              tone={data.totals.profit < 0 ? "text-status-danger" : "text-status-success"}
            />
          </div>
        )}

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No orders to cost"
              description="Orders appear here as soon as they exist — priced or not."
              icon={<IndianRupee className="h-12 w-12" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 text-right font-medium">Produced</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                    <th className="px-4 py-3 text-right font-medium">Profit</th>
                    <th className="px-4 py-3 text-right font-medium">Margin</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-ink-100/40">
                      <td className="px-4 py-3">
                        <Link to={`/order-pnl/${r.id}`} className="font-medium text-brand-600 hover:underline">
                          #{r.orderNo ?? "—"}
                        </Link>
                        <div className="text-xs text-ink-400">{r.po}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.customerName || <span className="text-ink-400">—</span>}
                        <div className="text-xs text-ink-400">{r.status}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{meters(r.producedMeters)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupee(r.orderValue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupee(r.cost)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          r.marginPct == null
                            ? "text-ink-400"
                            : r.profit < 0
                              ? "text-status-danger"
                              : "text-status-success"
                        }`}
                      >
                        {rupee(r.profit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          {r.warnings > 0 && (
                            <span
                              title={`${r.warnings} thing(s) this figure is missing`}
                              className="text-status-warning"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <StatusChip tone={marginTone(r.marginPct)}>
                            {marginLabel(r.marginPct)}
                          </StatusChip>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/order-pnl/${r.id}`} className="text-ink-400 hover:text-ink-900">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data && (
                <Pagination
                  page={data.page}
                  totalPages={data.pages}
                  total={data.total}
                  pageSize={data.limit}
                  onChange={setPage}
                />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default OrderPnlPage;
