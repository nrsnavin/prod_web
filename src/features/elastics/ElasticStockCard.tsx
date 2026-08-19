import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormScreen } from "@/components/ui/FormScreen";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { httpClient, ApiError } from "@/core/http/httpClient";

interface StockMovement {
  _id: string;
  date?: string;
  type?: string;
  requested?: number;
  /** Goods delta: what physically moved. */
  applied?: number;
  /** Goods balance after the movement. */
  balance?: number;
  /** Promise delta: how much became (or stopped being) spoken for. */
  reservedApplied?: number;
  /** Promise delta asked for. Differs from applied when it hit the floor. */
  reservedRequested?: number;
  /** Promise balance after. null on rows written before it was tracked. */
  reservedBalance?: number | null;
  /**
   * What could not be done, per side, from the server. null when the
   * movement applied exactly what was asked for — which is every
   * ordinary row, so a figure here is always worth reading.
   */
  shortfall?: number | null;
  reservedShortfall?: number | null;
  /** balance − reservedBalance, from the server. null when unknowable. */
  available?: number | null;
  refType?: string;
  reason?: string;
}

/**
 * What each movement means on the floor.
 *
 * The raw enum was printed straight onto the page, so a stock ledger —
 * the document someone reconciles a warehouse against — read
 * "PACKING_INWARD" and "DC_OUT". These are the names the people using
 * it already have for the same events.
 */
const MOVEMENT_LABEL: Record<string, string> = {
  PACKING_INWARD:      "Produced in",
  PACKING_REVERSE:     "Packing reversed",
  DC_OUT:              "Dispatched",
  DC_CANCEL_RETURN:    "Dispatch cancelled",
  WASTAGE_OUT:         "Wastage",
  WASTAGE_RETURN:      "Wastage reversed",
  MANUAL_ADJUST:       "Stock adjustment",
  RESERVATION_HOLD:    "Reserved for order",
  RESERVATION_RELEASE: "Reservation released",
};

interface StockResponse {
  success: boolean;
  elastic: {
    _id: string;
    name: string;
    stock: number;
    reservedStock: number;
    available: number;
    minStock: number;
    isLowStock: boolean;
    quantityProduced: number;
  };
  movements: StockMovement[];
  page: number;
  limit: number;
  total: number;
}

const nf = (n?: number) => (n ?? 0).toLocaleString("en-IN");

/**
 * One side of a movement: what changed, and what it left behind.
 *
 * A row that did not touch this side shows a dash rather than a zero —
 * "nothing happened here" and "it happened and came to nothing" are
 * different facts, and a column of green +0s was how a reservation
 * used to read as though it had done nothing at all.
 */
function Movement({
  delta,
  balance,
  neutral,
  shortfall,
}: {
  delta: number;
  balance: number | null;
  neutral?: boolean;
  /**
   * Set when the movement moved less than was asked for. Both balances
   * floor at zero, so a release of 400 against 250 held releases 250 —
   * and a cell showing only the 250 reads as though 400 was never
   * wanted. Absent on every ordinary row.
   */
  shortfall?: number | null;
}) {
  const tone = neutral
    ? "text-ink-900"
    : delta < 0
      ? "text-status-danger"
      : "text-status-success";
  return (
    <div className="leading-tight">
      {delta === 0 ? (
        <span className="text-ink-400">—</span>
      ) : (
        <span className={`tabular-nums font-medium ${tone}`}>
          {delta > 0 ? "+" : ""}
          {nf(delta)}
        </span>
      )}
      <p className="text-xs tabular-nums text-ink-400">
        {balance === null ? "—" : nf(balance)}
      </p>
      {shortfall != null && shortfall !== 0 && (
        <p
          className="text-xs tabular-nums text-status-warning"
          title="More was asked for than there was to give"
        >
          {/* shortfall is requested − applied, so the ask adds back. */}
          asked {nf(delta + shortfall)}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-canvas p-3">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${danger ? "text-status-danger" : ""}`}>{value}</p>
    </div>
  );
}

/**
 * Stock position + movement ledger for one elastic, with a manual
 * adjust flow (reason required; oversized deltas need a second,
 * explicit force-confirm — mirroring the backend threshold rule).
 */
export function ElasticStockCard({ elasticId }: { elasticId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [forcePrompt, setForcePrompt] = useState<string | null>(null); // server message

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["elastics", "stock", elasticId, page],
    queryFn: () =>
      httpClient.get<StockResponse>(`/elastic/${elasticId}/stock`, { page, limit: 10 }),
    placeholderData: (prev) => prev,
  });

  const adjust = useMutation({
    mutationFn: (force: boolean) =>
      httpClient.post(`/elastic/${elasticId}/adjust-stock`, {
        delta: Number(delta),
        reason: reason.trim(),
        ...(force ? { force: true } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elastics"] });
      toast("Stock adjusted", "success");
      setAdjustOpen(false);
      setForcePrompt(null);
      setDelta("");
      setReason("");
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : "Adjustment failed";
      // The backend rejects oversized deltas with a threshold message
      // unless force:true — surface it as an explicit second confirm.
      if (/force/i.test(msg)) setForcePrompt(msg);
      else toast(msg, "error");
    },
  });

  const submit = () => {
    if (!(Number(delta) !== 0) || !Number.isFinite(Number(delta)))
      return toast("Enter a non-zero adjustment (use negative to reduce)", "error");
    if (reason.trim().length < 3) return toast("A reason is required (min 3 chars)", "error");
    adjust.mutate(false);
  };

  const columns: Column<StockMovement>[] = [
    {
      key: "date",
      header: "Date",
      render: (m) => (m.date ? new Date(m.date).toLocaleDateString("en-IN") : "—"),
    },
    {
      key: "type",
      header: "Movement",
      render: (m) => (
        <span className="font-medium">
          {MOVEMENT_LABEL[m.type ?? ""] ?? m.type ?? "—"}
        </span>
      ),
    },
    {
      // Delta above, resulting balance below. Both sides of the ledger
      // read the same way, so "what moved" and "what it left behind"
      // are one glance rather than two columns apart.
      key: "goods",
      header: "Goods · on hand",
      align: "right",
      render: (m) => (
        <Movement delta={m.applied ?? 0} balance={m.balance ?? 0} shortfall={m.shortfall} />
      ),
    },
    {
      key: "reserved",
      header: "Reserved",
      align: "right",
      render: (m) => (
        <Movement
          delta={m.reservedApplied ?? 0}
          balance={m.reservedBalance ?? null}
          shortfall={m.reservedShortfall}
          // A promise raised is not goods gained; colour it as neither.
          neutral
        />
      ),
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      render: (m) =>
        m.available === null || m.available === undefined ? (
          <span className="text-ink-400" title="This movement predates reservation tracking">
            —
          </span>
        ) : (
          <span className="tabular-nums">{nf(m.available)}</span>
        ),
    },
    {
      key: "reason",
      header: "Reason / source",
      render: (m) => <span className="text-ink-600">{m.reason || m.refType || "—"}</span>,
    },
  ];

  const e = data?.elastic;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Boxes className="h-4 w-4 text-brand-500" /> Stock
          {e?.isLowStock && <StatusChip tone="danger">LOW</StatusChip>}
        </h3>
        <Button size="sm" onClick={() => setAdjustOpen(true)}>
          <Plus className="h-4 w-4" /> Adjust stock
        </Button>
      </div>

      {isLoading || !e ? (
        <Skeleton className="mt-4 h-32 w-full" />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="In stock (m)" value={nf(e.stock)} danger={e.isLowStock} />
            <Stat label="Reserved" value={nf(e.reservedStock)} />
            <Stat label="Available" value={nf(e.available)} />
            <Stat label="Min stock" value={nf(e.minStock)} />
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Movement ledger
            </p>
            <DataTable
              columns={columns}
              rows={data?.movements ?? []}
              rowKey={(m) => m._id}
              error={isError ? error : undefined}
              errorWhat="stock movements"
              emptyTitle="No stock movements yet"
            />
            {totalPages > 1 && (
              <div className="mt-3">
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            )}
          </div>
        </>
      )}

      <FormScreen open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust stock" width="max-w-md">
        <div className="space-y-4">
          <Input
            label="Adjustment (m) — negative reduces"
            type="number"
            step="0.01"
            value={delta}
            onChange={(ev) => setDelta(ev.target.value)}
            placeholder="e.g. 250 or -120"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason *</label>
            <textarea
              aria-label="Reason for the adjustment"
              rows={2}
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="e.g. physical stock count correction"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <p className="text-xs text-ink-400">
            Recorded in the movement ledger with your name. Large adjustments ask for a second confirmation.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button type="button" loading={adjust.isPending && !forcePrompt} onClick={submit}>
              Apply adjustment
            </Button>
          </div>
        </div>
      </FormScreen>

      <ConfirmDialog
        open={!!forcePrompt}
        title="Large adjustment — are you sure?"
        message={forcePrompt ?? ""}
        confirmLabel="Yes, apply anyway"
        danger
        loading={adjust.isPending}
        onCancel={() => setForcePrompt(null)}
        onConfirm={() => adjust.mutate(true)}
      />
    </Card>
  );
}
