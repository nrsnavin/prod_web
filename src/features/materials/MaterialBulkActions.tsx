import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Download, IndianRupee, Layers, Pencil, ShoppingCart, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectionBar } from "@/components/ui/SelectionBar";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu, ActionMenuItem } from "@/components/ui/ActionMenu";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";
import { downloadCsv, toCsv } from "@/core/format/csv";
import type { BulkResult } from "@/features/elastics/api";
import { ResultDialog } from "@/features/elastics/ElasticBulkActions";
import { useMaterialGroups } from "../materialGroups/hooks";
import { useMaterialMutations } from "./hooks";
import { materialService } from "./api";
import { RawMaterial } from "./types";
import { BulkPriceUpdateModal } from "./StockOps";

// ══════════════════════════════════════════════════════════════════
//  ACTING ON THE MATERIALS TICKED IN THE LIST
//
//  Raise a PO for them (one per supplier — the purchase order form
//  opens filled in, to check and save), or change supplier, min stock,
//  group or price on all of them, archive or restore, export.
// ══════════════════════════════════════════════════════════════════

const supplierOf = (m: RawMaterial) =>
  m.supplier && typeof m.supplier === "object" ? m.supplier : m.supplier ? { _id: m.supplier, name: "" } : null;

/** The same top-up the reorder suggestions use: back up to twice the minimum. */
export const reorderQty = (m: RawMaterial) => Math.max(0, Math.ceil((m.minStock ?? 0) * 2 - (m.stock ?? 0)));

/** The ticked materials grouped by supplier — a purchase order goes to one. */
export function bySupplier(rows: RawMaterial[]) {
  const groups = new Map<string, { supplierId: string; supplierName: string; items: RawMaterial[] }>();
  for (const m of rows) {
    const s = supplierOf(m);
    const key = s?._id ?? "";
    if (!groups.has(key)) groups.set(key, { supplierId: key, supplierName: s?.name || (key ? "Supplier" : "No supplier set"), items: [] });
    groups.get(key)!.items.push(m);
  }
  return [...groups.values()];
}

/** Router state that opens the purchase order form filled in for one supplier's share. */
export const poState = (g: ReturnType<typeof bySupplier>[number]) => ({
  prefill: {
    supplier: g.supplierId,
    supplierName: g.supplierId ? g.supplierName : undefined,
    items: g.items.map((m) => ({ rawMaterial: m._id, quantity: reorderQty(m), price: m.price ?? 0 })),
  },
});

export function materialsCsv(rows: RawMaterial[]): string {
  return toCsv(
    ["Name", "Category", "Group", "Supplier", "Unit", "Stock", "Min stock", "Price", "Status"],
    rows.map((m) => [
      m.name, m.category ?? "", m.group && typeof m.group === "object" ? m.group.name : "",
      supplierOf(m)?.name ?? "", m.unit ?? "", m.stock ?? 0, m.minStock ?? 0, m.price ?? 0,
      m.archived ? "Archived" : "Active",
    ])
  );
}

type Dialog = null | "po" | "supplier" | "minStock" | "group" | "price" | "archive" | "restore";

function SupplierDialog({ count, loading, onClose, onApply }: {
  count: number; loading: boolean; onClose: () => void; onApply: (supplier: string) => void;
}) {
  const [supplier, setSupplier] = useState("");
  const load = useCallback(
    (q: string) => materialService.supplierOptions(q).then((s) => s.map((x) => ({ value: x._id, label: x.name }))),
    []
  );
  return (
    <Modal open onClose={onClose} title={`Supplier for ${count} material${count === 1 ? "" : "s"}`} width="max-w-md">
      <div className="space-y-4">
        <AsyncCombobox label="Supplier" value={supplier} onChange={setSupplier} loadOptions={load} placeholder="Search suppliers" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button loading={loading} disabled={!supplier} onClick={() => onApply(supplier)}>Set for {count}</Button>
        </div>
      </div>
    </Modal>
  );
}

function MinStockDialog({ count, loading, onClose, onApply }: {
  count: number; loading: boolean; onClose: () => void; onApply: (v: number) => void;
}) {
  const [value, setValue] = useState("");
  const n = Number(value);
  return (
    <Modal open onClose={onClose} title={`Min stock for ${count} material${count === 1 ? "" : "s"}`} width="max-w-sm">
      <div className="space-y-4">
        <Input label="Min stock" type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus
          hint="In each material's own unit. Stock at or under it shows as low; 0 turns the alert off." />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button loading={loading} disabled={value === "" || !Number.isFinite(n) || n < 0} onClick={() => onApply(n)}>Set for {count}</Button>
        </div>
      </div>
    </Modal>
  );
}

function GroupDialog({ count, loading, onClose, onApply }: {
  count: number; loading: boolean; onClose: () => void; onApply: (group: string | null) => void;
}) {
  const groups = useMaterialGroups();
  const [group, setGroup] = useState("");
  const NONE = "__none__";
  return (
    <Modal open onClose={onClose} title={`Group for ${count} material${count === 1 ? "" : "s"}`} width="max-w-sm">
      <div className="space-y-4">
        <Select
          label="Group"
          placeholder="Choose a group"
          options={[...(groups.data ?? []).map((g) => ({ value: g._id, label: g.name })), { value: NONE, label: "No group" }]}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
        <p className="text-xs text-ink-400">Each keeps its category. One whose category the group does not carry is listed afterwards, unchanged.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button loading={loading} disabled={!group} onClick={() => onApply(group === NONE ? null : group)}>Set for {count}</Button>
        </div>
      </div>
    </Modal>
  );
}

function PoDialog({ selected, onClose }: { selected: RawMaterial[]; onClose: () => void }) {
  const navigate = useNavigate();
  const groups = bySupplier(selected);
  const raise = (g: ReturnType<typeof bySupplier>[number]) => navigate("/purchase-orders/new", { state: poState(g) });
  return (
    <Modal open onClose={onClose} title="Raise a purchase order" width="max-w-lg">
      <div className="space-y-3">
        <p className="text-xs text-ink-400">
          A purchase order goes to one supplier. These come from {groups.length}; raise one at a time.
          Quantities start at what brings each back to twice its minimum, to change on the order.
        </p>
        <ul className="divide-y divide-ink-100">
          {groups.map((g) => (
            <li key={g.supplierId || "none"} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{g.supplierName}</p>
                <p className="truncate text-xs text-ink-400">{g.items.map((m) => m.name).join(", ")}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => raise(g)}>
                PO for {g.items.length}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

export function MaterialBulkActions({ selected, onClear }: { selected: RawMaterial[]; onClear: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { bulkUpdate, bulkArchive } = useMaterialMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [result, setResult] = useState<{ title: string; result: BulkResult } | null>(null);

  const ids = selected.map((m) => m._id);
  const n = selected.length;
  const active = selected.filter((m) => !m.archived);
  const archived = selected.filter((m) => m.archived);
  const suppliers = bySupplier(selected);

  const finish = (title: string) => ({
    onSuccess: (r: BulkResult) => {
      setDialog(null);
      if (r.refused === 0) toast(`${title}: ${r.done} done`, "success");
      else setResult({ title, result: r });
    },
    onError: (e: unknown) => {
      setDialog(null);
      toast(e instanceof ApiError ? e.message : `${title} failed`, "error");
    },
  });

  const raisePo = () => {
    // One supplier: straight to the order. Several: choose which first.
    if (suppliers.length === 1) navigate("/purchase-orders/new", { state: poState(suppliers[0]) });
    else setDialog("po");
  };

  const change: ActionMenuItem[] = [
    { label: "Supplier…", icon: <Truck className="h-4 w-4" />, onSelect: () => setDialog("supplier") },
    { label: "Min stock…", icon: <Warehouse className="h-4 w-4" />, onSelect: () => setDialog("minStock") },
    { label: "Group…", icon: <Layers className="h-4 w-4" />, onSelect: () => setDialog("group") },
    { label: "Prices…", icon: <IndianRupee className="h-4 w-4" />, onSelect: () => setDialog("price") },
    ...(active.length ? [{ label: `Archive (${active.length})`, icon: <Archive className="h-4 w-4" />, onSelect: () => setDialog("archive") }] : []),
    ...(archived.length ? [{ label: `Restore (${archived.length})`, icon: <ArchiveRestore className="h-4 w-4" />, onSelect: () => setDialog("restore") }] : []),
  ];

  return (
    <>
      <SelectionBar count={n} label="Actions on the selected materials" onClear={onClear}>
        {canAccessPath("/purchase-orders", user) && (
          <Button size="sm" variant="secondary" onClick={raisePo} disabled={active.length < n}
            title={active.length < n ? "Archived materials cannot be ordered" : undefined}>
            <ShoppingCart className="h-4 w-4" /> Raise PO{suppliers.length > 1 ? "…" : ""}
          </Button>
        )}
        <ActionMenu label="Change" icon={<Pencil className="h-4 w-4" />} items={change} />
        <Button size="sm" variant="ghost"
          onClick={() => downloadCsv(`materials-${new Date().toISOString().slice(0, 10)}.csv`, materialsCsv(selected))}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </SelectionBar>

      {dialog === "po" && <PoDialog selected={selected} onClose={() => setDialog(null)} />}
      {dialog === "supplier" && (
        <SupplierDialog count={n} loading={bulkUpdate.isPending} onClose={() => setDialog(null)}
          onApply={(supplier) => bulkUpdate.mutate({ ids, change: { supplier } }, finish("Supplier"))} />
      )}
      {dialog === "minStock" && (
        <MinStockDialog count={n} loading={bulkUpdate.isPending} onClose={() => setDialog(null)}
          onApply={(minStock) => bulkUpdate.mutate({ ids, change: { minStock } }, finish("Min stock"))} />
      )}
      {dialog === "group" && (
        <GroupDialog count={n} loading={bulkUpdate.isPending} onClose={() => setDialog(null)}
          onApply={(group) => bulkUpdate.mutate({ ids, change: { group } }, finish("Group"))} />
      )}
      {dialog === "price" && <BulkPriceUpdateModal materials={selected} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "archive"}
        title={`Archive ${active.length} material${active.length === 1 ? "" : "s"}?`}
        message="They drop out of pickers; nothing is deleted, and they can be restored. Any an open order still needs is left as it is, and listed."
        confirmLabel="Archive"
        danger
        loading={bulkArchive.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => bulkArchive.mutate({ ids: active.map((m) => m._id), archived: true }, finish("Archive"))}
      />
      <ConfirmDialog
        open={dialog === "restore"}
        title={`Restore ${archived.length} material${archived.length === 1 ? "" : "s"}?`}
        message="They come back into pickers."
        confirmLabel="Restore"
        loading={bulkArchive.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => bulkArchive.mutate({ ids: archived.map((m) => m._id), archived: false }, finish("Restore"))}
      />
      {result && <ResultDialog title={result.title} result={result.result} onClose={() => setResult(null)} />}
    </>
  );
}
