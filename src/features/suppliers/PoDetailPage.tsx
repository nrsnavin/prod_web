import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, PackagePlus, FileText, FileDown, Pencil, Trash2, Plus } from "lucide-react";
import { PrintModal } from "@/components/print/PrintModal";
import { PoDocument } from "./PoDocument";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { useMaterials } from "@/features/materials/hooks";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { usePurchaseOrder, usePoMutations } from "./hooks";
import { poService } from "./api";
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
  { key: "qty", header: "Ordered", align: "right", render: (it) => it.quantity.toLocaleString("en-IN") },
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
          <span className="tabular-nums">{(it.received ?? 0).toLocaleString("en-IN")}</span>
        </span>
      );
    },
  },
  { key: "price", header: "Price (₹)", align: "right", render: (it) => it.price.toLocaleString("en-IN") },
  {
    key: "total",
    header: "Total (₹)",
    align: "right",
    render: (it) => (it.price * it.quantity).toLocaleString("en-IN"),
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
  // lotNo/shade were already being sent but were missing from this type.
  // They matter now: a row carrying a lot number opens a YarnLot bucket
  // server-side, which is what lets a warping batch be tied to the exact
  // dye lot it was warped from.
  onSubmit: (
    rows: Array<{
      rawMaterial: string;
      quantity: number;
      remarks?: string;
      lotNo?: string;
      shade?: string;
    }>
  ) => void;
  onCancel: () => void;
}) {
  const pending = items.filter((it) => (it.received ?? 0) < it.quantity);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [lots, setLots] = useState<Record<string, string>>({});
  const [shades, setShades] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");

  const rows = pending
    .map((it) => ({
      rawMaterial: materialId(it),
      quantity: Number(qty[materialId(it)]) || 0,
      lotNo: lots[materialId(it)]?.trim() || undefined,
      shade: shades[materialId(it)]?.trim() || undefined,
    }))
    .filter((r) => r.quantity > 0);

  if (pending.length === 0) {
    return <EmptyState title="Fully received" description="All items on this PO have been received." />;
  }

  return (
    <div className="space-y-4">
      {/* Column headers label the repeating row inputs below — the inputs
          themselves only carried placeholders, which vanish once typed. */}
      <div className="grid grid-cols-[1fr_90px_100px_100px] gap-2 px-1 text-xs font-medium text-ink-400">
        <span>Material</span>
        <span>Qty received</span>
        <span>Lot no</span>
        <span>Shade</span>
      </div>
      <div className="space-y-2">
        {pending.map((it) => {
          const idKey = materialId(it);
          const remaining = it.quantity - (it.received ?? 0);
          return (
            <div key={idKey} className="grid grid-cols-[1fr_90px_100px_100px] gap-2 items-center">
              <div>
                <p className="text-sm font-medium">{materialName(it)}</p>
                <p className="text-xs text-ink-400">
                  {remaining.toLocaleString("en-IN")} of {it.quantity.toLocaleString("en-IN")} pending
                </p>
              </div>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={remaining}
                aria-label={`Quantity received for ${materialName(it)}`}
                placeholder="Qty"
                value={qty[idKey] ?? ""}
                onChange={(e) => setQty((q) => ({ ...q, [idKey]: e.target.value }))}
              />
              <Input
                aria-label={`Lot number for ${materialName(it)}`}
                placeholder="Lot no"
                value={lots[idKey] ?? ""}
                onChange={(e) => setLots((l) => ({ ...l, [idKey]: e.target.value }))}
              />
              <Input
                aria-label={`Shade for ${materialName(it)}`}
                placeholder="Shade"
                value={shades[idKey] ?? ""}
                onChange={(e) => setShades((s) => ({ ...s, [idKey]: e.target.value }))}
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

type EditLine = { rawMaterial: string; quantity: string; price: string };

function PoEditModal({
  po,
  open,
  onClose,
  update,
}: {
  po: { _id: string; expectedDate?: string; notes?: string; items: PoItem[]; __v?: number };
  open: boolean;
  onClose: () => void;
  update: ReturnType<typeof usePoMutations>["update"];
}) {
  const { toast } = useToast();
  const materials = useMaterials({ search: "", category: "all", lowStock: false });
  const [expectedDate, setExpectedDate] = useState(po.expectedDate ? po.expectedDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(po.notes ?? "");
  const [auditReason, setAuditReason] = useState("");
  const [lines, setLines] = useState<EditLine[]>(
    po.items.map((it) => ({ rawMaterial: materialId(it), quantity: String(it.quantity), price: String(it.price) }))
  );

  const materialOptions = (materials.data ?? []).map((m) => ({ value: m._id, label: `${m.name} (${m.category})` }));
  const setLine = (i: number, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { rawMaterial: "", quantity: "", price: "" }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0);

  const save = () => {
    if (auditReason.trim().length < 3) { toast("Give a reason (min 3 chars) for the edit", "error"); return; }
    const items = lines
      .filter((l) => l.rawMaterial)
      .map((l) => ({ rawMaterial: l.rawMaterial, quantity: Number(l.quantity) || 0, price: Number(l.price) || 0 }));
    if (items.length === 0) { toast("Add at least one line item", "error"); return; }
    if (items.some((it) => it.quantity <= 0)) { toast("Every line needs a quantity greater than 0", "error"); return; }
    update.mutate(
      {
        id: po._id,
        // expectedVersion = the __v this modal loaded — the server 409s
        // if someone else saved in between (optimistic lock).
        body: { expectedDate, notes, items, auditReason: auditReason.trim(), expectedVersion: po.__v },
      },
      {
        onSuccess: () => { toast("Purchase order updated", "success"); onClose(); },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) {
            toast("Someone else edited this PO — reloading the latest version", "error");
            onClose();
            return;
          }
          toast(e instanceof ApiError ? e.message : "Update failed", "error");
        },
      }
    );
  };

  return (
    <FormScreen open={open} onClose={onClose} title="Edit purchase order" width="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs text-ink-400">Only Open POs with no receipts can be edited.</p>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-600">Line items *</p>
          <div className="hidden grid-cols-[1fr_90px_100px_90px_32px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
            <span>Material</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_100px_90px_32px] items-start gap-2">
                <Combobox
                  aria-label="Material"
                  placeholder={materials.isLoading ? "Loading…" : "Material"}
                  options={materialOptions}
                  value={l.rawMaterial}
                  onChange={(v) => setLine(i, { rawMaterial: v })}
                />
                <Input type="number" step="0.01" aria-label="Quantity" placeholder="Qty"
                  value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                <Input type="number" step="0.01" aria-label="Rate in rupees" placeholder="Rate"
                  value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
                <div className="flex h-10 items-center justify-end text-sm tabular-nums text-ink-600">
                  {((Number(l.quantity) || 0) * (Number(l.price) || 0)).toLocaleString("en-IN")}
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="grid h-10 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                  disabled={lines.length <= 1}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
            <span className="text-sm font-semibold tabular-nums">Total ₹{total.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Requested delivery date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Terms / notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason for edit *</label>
          <textarea
            rows={2}
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="Why is this being changed? (recorded in the audit log)"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={update.isPending} onClick={save}>Save changes</Button>
        </div>
      </div>
    </FormScreen>
  );
}

export function PoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = usePurchaseOrder(id);
  const { clone, inward, update, remove } = usePoMutations();
  const [inwardOpen, setInwardOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const blob = await poService.pdfBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not generate the PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

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
  const editable = po.status === "Open" && !po.items.some((it) => (it.received ?? 0) > 0);

  return (
    <>
      <Link to="/purchase-orders" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Purchase orders
      </Link>
      <PageHeader
        title={`PO #${po.poNo}`}
        subtitle={`${supplierName} · ₹${total.toLocaleString("en-IN")}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPrintOpen(true)}>
              <FileText className="h-4 w-4" /> View PDF
            </Button>
            <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
              <FileDown className="h-4 w-4" /> Download PDF
            </Button>
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
            {editable && (
              <>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="danger" onClick={() => setDelOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            )}
          </>
        }
      />

      <PoEditModal
        po={{ _id: po._id, expectedDate: po.expectedDate, notes: po.notes, items: po.items }}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        update={update}
      />
      <ReasonDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title={`Delete PO #${po.poNo}`}
        description="The PO is cancelled (kept for audit) and recorded in the audit trail. Only Open POs with no receipts can be deleted."
        confirmLabel="Delete PO"
        loading={remove.isPending}
        onConfirm={(reason) =>
          remove.mutate(
            { id: po._id, auditReason: reason },
            {
              onSuccess: () => { toast("Purchase order deleted", "success"); navigate("/purchase-orders"); },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
            }
          )
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
                  +{rec.quantity.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PrintModal open={printOpen} onClose={() => setPrintOpen(false)} title={`Purchase order #${po.poNo}`}>
        <PoDocument po={po} />
      </PrintModal>

      <FormScreen open={inwardOpen} onClose={() => setInwardOpen(false)} title="Record goods received">
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
      </FormScreen>
    </>
  );
}
