import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { usePurchaseOrder, usePoMutations } from "./hooks";
import { InwardRecord, PoItem } from "./types";
import { poStatusTone } from "./PoListPage";

function materialName(item: PoItem): string {
  return typeof item.rawMaterial === "object" && item.rawMaterial
    ? item.rawMaterial.name
    : "—";
}
function materialId(item: PoItem): string {
  return typeof item.rawMaterial === "object" && item.rawMaterial
    ? item.rawMaterial._id
    : (item.rawMaterial as string);
}

const itemColumns: Column<PoItem>[] = [
  { key: "mat", header: "Material", render: (it) => <span className="font-medium">{materialName(it)}</span> },
  { key: "qty", header: "Ordered", align: "right", render: (it) => it.quantity.toLocaleString() },
  {
    key: "recv",
    header: "Received",
    align: "right",
    render: (it) => {
      const pct = it.quantity > 0 ? ((it.received ?? 0) / it.quantity) * 100 : 0;
      return (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-16 rounded-full bg-ink-100 overflow-hidden">
            <span
              className="block h-full rounded-full bg-status-success"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </span>
          <span className="tabular-nums">{(it.received ?? 0).toLocaleString()}</span>
        </span>
      );
    },
  },
  { key: "price", header: "Price (₹)", align: "right", render: (it) => it.price.toLocaleString() },
  {
    key: "total",
    header: "Total (₹)",
    align: "right",
    render: (it) => (it.price * it.quantity).toLocaleString(),
  },
];

function InwardForm({
  items,
  submitting,
  onSubmit,
  onCancel,
}: {
  items: PoItem[];
  submitting: boolean;
  onSubmit: (rows: Array<{ rawMaterial: string; quantity: number; remarks?: string }>) => void;
  onCancel: () => void;
}) {
  const pending = items.filter((it) => (it.received ?? 0) < it.quantity);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");

  const rows = pending
    .map((it) => ({
      rawMaterial: materialId(it),
      quantity: Number(qty[materialId(it)]) || 0,
    }))
    .filter((r) => r.quantity > 0);

  if (pending.length === 0) {
    return <EmptyState title="Fully received" description="All items on this PO have been received." />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {pending.map((it) => {
          const idKey = materialId(it);
          const remaining = it.quantity - (it.received ?? 0);
          return (
            <div key={idKey} className="grid grid-cols-[1fr_110px] gap-2 items-center">
              <div>
                <p className="text-sm font-medium">{materialName(it)}</p>
                <p className="text-xs text-ink-400">
                  {remaining.toLocaleString()} of {it.quantity.toLocaleString()} pending
                </p>
              </div>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={remaining}
                placeholder="Qty"
                value={qty[idKey] ?? ""}
                onChange={(e) => setQty((q) => ({ ...q, [idKey]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>
      <Input
        label="Remarks"
        placeholder="e.g. Invoice no, lot no"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={rows.length === 0}
          loading={submitting}
          onClick={() =>
            onSubmit(rows.map((r) => ({ ...r, remarks: remarks || undefined })))
          }
        >
          Record inward
        </Button>
      </div>
    </div>
  );
}

export function PoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = usePurchaseOrder(id);
  const { clone, inward } = usePoMutations();
  const [inwardOpen, setInwardOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "PO not found"}
      </p>
    );
  }

  const { po, inwardHistory } = data;
  const supplierName = typeof po.supplier === "object" && po.supplier ? po.supplier.name : "—";
  const total = po.items.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <>
      <Link to="/purchase-orders" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Purchase orders
      </Link>
      <PageHeader
        title={`PO #${po.poNo}`}
        subtitle={`${supplierName} · ₹${total.toLocaleString()}`}
        actions={
          <>
            {po.status !== "Completed" && (
              <Button onClick={() => setInwardOpen(true)}>
                <PackagePlus className="h-4 w-4" /> Record inward
              </Button>
            )}
            <Button
              variant="secondary"
              loading={clone.isPending}
              onClick={() =>
                clone.mutate(po._id, {
                  onSuccess: (newPo) => {
                    toast(`Cloned as PO #${newPo.poNo}`, "success");
                    navigate(`/purchase-orders/${newPo._id}`);
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Clone failed", "error"),
                })
              }
            >
              <Copy className="h-4 w-4" /> Clone
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <StatusChip tone={poStatusTone[po.status]}>{po.status}</StatusChip>
        {po.createdAt && (
          <span className="ml-3 text-sm text-ink-400">
            Created {new Date(po.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <Card>
        <h3 className="font-semibold px-5 pt-5">Items</h3>
        <DataTable columns={itemColumns} rows={po.items} rowKey={materialId} emptyTitle="No items" />
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Inward history</h3>
        {inwardHistory.length === 0 ? (
          <EmptyState title="No inwards yet" description="Received goods will appear here." />
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {inwardHistory.map((rec: InwardRecord) => (
              <li key={rec._id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {typeof rec.rawMaterial === "object" && rec.rawMaterial
                      ? rec.rawMaterial.name
                      : "Material"}
                  </p>
                  <p className="text-xs text-ink-400">
                    {new Date(rec.inwardDate ?? rec.createdAt ?? "").toLocaleDateString()}
                    {rec.remarks && ` · ${rec.remarks}`}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-status-success">
                  +{rec.quantity.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={inwardOpen} onClose={() => setInwardOpen(false)} title="Record goods received">
        <InwardForm
          items={po.items}
          submitting={inward.isPending}
          onCancel={() => setInwardOpen(false)}
          onSubmit={(rows) =>
            inward.mutate(
              { poId: po._id, items: rows },
              {
                onSuccess: (res) => {
                  setInwardOpen(false);
                  toast(res.message ?? "Inward recorded", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Inward failed", "error"),
              }
            )
          }
        />
      </Modal>
    </>
  );
}
