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
  applied?: number;
  balance?: number;
  refType?: string;
  reason?: string;
}

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

  const { data, isLoading } = useQuery({
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
    { key: "type", header: "Type", render: (m) => <span className="capitalize">{m.type ?? "—"}</span> },
    {
      key: "applied",
      header: "Qty (m)",
      align: "right",
      render: (m) => {
        const v = m.applied ?? 0;
        return (
          <span className={`tabular-nums font-medium ${v < 0 ? "text-status-danger" : "text-status-success"}`}>
            {v > 0 ? "+" : ""}
            {nf(v)}
          </span>
        );
      },
    },
    { key: "balance", header: "Balance", align: "right", render: (m) => nf(m.balance) },
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
