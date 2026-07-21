import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, ClipboardList, IndianRupee } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { useToast } from "@/components/ui/Toast";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { poService } from "@/features/suppliers/api";
import { materialService } from "./api";
import { BulkPriceResult, RawMaterial } from "./types";

// ── Reorder suggestions (Phase 4) ───────────────────────────────────────
interface ReorderGroup {
  supplierId: string | null;
  supplierName: string;
  estimatedValue: number;
  items: Array<{
    materialId: string;
    name: string;
    stock: number;
    minStock: number;
    price: number;
    suggestedQty: number;
  }>;
}

export function ReorderSuggestions() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["reorder-suggestions"],
    queryFn: async () =>
      (
        await httpClient.get<{ success: boolean; count: number; suppliers: ReorderGroup[] }>(
          "/materials/reorder-suggestions"
        )
      ).suppliers,
  });
  const createPo = useMutation({
    mutationFn: (g: ReorderGroup) => {
      // Only order lines with a real positive quantity — a zero line
      // would be rejected by the PO endpoint.
      const items = g.items
        .filter((i) => i.suggestedQty > 0)
        .map((i) => ({ rawMaterial: i.materialId, quantity: i.suggestedQty, price: i.price }));
      if (items.length === 0) {
        return Promise.reject(new Error("Nothing to order — set a minimum stock for these items first."));
      }
      return poService.create({ supplier: g.supplierId!, items });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  if (!data || data.length === 0) return null;

  return (
    <Card className="mb-4 p-4 border-l-4 border-status-warning">
      <h3 className="text-sm font-semibold">Reorder suggestions — stock at or below minimum</h3>
      <div className="mt-2 space-y-2">
        {data.map((g) => (
          <div key={g.supplierId ?? "none"} className="flex flex-wrap items-center gap-3 text-sm">
            <div className="min-w-0 flex-1">
              <span className="font-medium">{g.supplierName}</span>
              <span className="text-ink-400">
                {" "}
                — {g.items.map((i) => `${i.name} (+${i.suggestedQty})`).join(", ")}
              </span>
            </div>
            <span className="tabular-nums text-ink-600">
              ≈ ₹{g.estimatedValue.toLocaleString("en-IN")}
            </span>
            {g.supplierId ? (
              <Button
                size="sm"
                variant="secondary"
                loading={createPo.isPending}
                onClick={() =>
                  createPo.mutate(g, {
                    onSuccess: (po) => {
                      toast(`PO #${po.poNo} drafted for ${g.supplierName}`, "success");
                      navigate(`/purchase-orders/${po._id}`);
                    },
                    onError: (e) =>
                      toast(e instanceof Error ? e.message : "PO creation failed", "error"),
                  })
                }
              >
                <ShoppingCart className="h-4 w-4" /> Raise PO
              </Button>
            ) : (
              <span className="text-xs text-ink-400">set a supplier to enable one-click PO</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Stock take / cycle count (Phase 3) ──────────────────────────────────
export function StockTakeModal({
  materials,
  onClose,
}: {
  materials: RawMaterial[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [counted, setCounted] = useState<Record<string, string>>({});

  const variances = useMemo(
    () =>
      materials
        .map((m) => {
          const v = counted[m._id];
          if (v === undefined || v === "") return null;
          const adjustment = Number(v) - m.stock;
          return { m, countedQty: Number(v), adjustment };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null && x.adjustment !== 0),
    [materials, counted]
  );

  const submit = useMutation({
    mutationFn: () =>
      httpClient.post("/materials/bulk-adjust-stock", {
        adjustments: variances.map((v) => ({
          _id: v.m._id,
          adjustment: v.adjustment,
          reason: "Stock take (cycle count)",
        })),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials"] }),
  });

  return (
    <FormScreen open onClose={onClose} title="Stock take" width="max-w-xl">
      <p className="text-sm text-ink-400 mb-3">
        Enter physically counted quantities — only materials with a variance are adjusted, each
        with a ledger entry.
      </p>
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {materials.map((m) => {
          const v = counted[m._id];
          const diff = v !== undefined && v !== "" ? Number(v) - m.stock : null;
          return (
            <div key={m._id} className="grid grid-cols-[1fr_110px_90px] gap-2 items-center text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-xs text-ink-400">system: {m.stock.toLocaleString("en-IN")}</p>
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="Counted"
                value={v ?? ""}
                onChange={(e) => setCounted((c) => ({ ...c, [m._id]: e.target.value }))}
                className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
              />
              <span
                className={
                  diff === null || diff === 0
                    ? "text-ink-400"
                    : diff > 0
                      ? "text-status-success font-semibold tabular-nums"
                      : "text-status-danger font-semibold tabular-nums"
                }
              >
                {diff === null ? "—" : diff === 0 ? "match" : (diff > 0 ? "+" : "") + diff.toLocaleString("en-IN")}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="mr-auto text-sm text-ink-600">
          {variances.length} variance{variances.length === 1 ? "" : "s"} to post
        </span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={variances.length === 0}
          loading={submit.isPending}
          onClick={() =>
            submit.mutate(undefined, {
              onSuccess: () => {
                toast(`Stock take posted — ${variances.length} adjustments`, "success");
                onClose();
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Stock take failed", "error"),
            })
          }
        >
          <ClipboardList className="h-4 w-4" /> Post adjustments
        </Button>
      </div>
    </FormScreen>
  );
}

// ── Bulk price update ───────────────────────────────────────────────────
//  Mirrors POST /materials/bulk-update-prices — enter a new price for each
//  material; only rows that actually changed are sent, each stamping a
//  priceHistory entry with the shared reason.
export function BulkPriceUpdateModal({
  materials,
  onClose,
}: {
  materials: RawMaterial[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");

  const changes = useMemo(
    () =>
      materials
        .map((m) => {
          const v = prices[m._id];
          if (v === undefined || v === "") return null;
          const next = Number(v);
          if (isNaN(next) || next < 0 || next === m.price) return null;
          return { m, newPrice: next, delta: next - m.price };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [materials, prices]
  );

  const submit = useMutation({
    mutationFn: () =>
      materialService.bulkUpdatePrices(
        changes.map((c) => ({ _id: c.m._id, price: c.newPrice })),
        reason.trim() || "Bulk price update"
      ),
    onSuccess: (res: BulkPriceResult) => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      toast(
        res.skipped > 0
          ? `${res.updated} price(s) updated, ${res.skipped} skipped`
          : `${res.updated} price(s) updated`,
        "success"
      );
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Price update failed", "error"),
  });

  return (
    <FormScreen open onClose={onClose} title="Bulk price update" width="max-w-xl">
      <p className="text-sm text-ink-400 mb-3">
        Enter the new unit price for any material — only rows you change are updated, each with a
        price-history entry using the reason below.
      </p>
      <input
        type="text"
        placeholder="Reason (e.g. Monthly revision, supplier hike)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mb-3 h-9 w-full rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
      />
      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {materials.map((m) => {
          const v = prices[m._id];
          const next = v !== undefined && v !== "" ? Number(v) : null;
          const delta = next !== null && !isNaN(next) && next !== m.price ? next - m.price : null;
          return (
            <div key={m._id} className="grid grid-cols-[1fr_120px_90px] gap-2 items-center text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{m.name}</p>
                <p className="text-xs text-ink-400">
                  current: ₹{m.price.toLocaleString("en-IN")}
                </p>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="New price"
                value={v ?? ""}
                onChange={(e) => setPrices((p) => ({ ...p, [m._id]: e.target.value }))}
                className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
              />
              <span
                className={
                  delta === null
                    ? "text-ink-400"
                    : delta > 0
                      ? "text-status-danger font-semibold tabular-nums"
                      : "text-status-success font-semibold tabular-nums"
                }
              >
                {delta === null
                  ? "—"
                  : `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="mr-auto text-sm text-ink-600">
          {changes.length} price{changes.length === 1 ? "" : "s"} to update
        </span>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={changes.length === 0}
          loading={submit.isPending}
          onClick={() => submit.mutate()}
        >
          <IndianRupee className="h-4 w-4" /> Update prices
        </Button>
      </div>
    </FormScreen>
  );
}
