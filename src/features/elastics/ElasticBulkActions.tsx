import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive, ArchiveRestore, Columns3, Copy, Download, FileSpreadsheet, FileText, FlaskConical,
  IndianRupee, Layers, PackagePlus, Pencil, Plus, Printer, ShoppingCart, Truck, Warehouse, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu, ActionMenuItem } from "@/components/ui/ActionMenu";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";
import { downloadCsv, toCsv } from "@/core/format/csv";
import { orderService } from "@/features/orders/api";
import { elasticGroupService } from "@/features/elasticGroups/api";
import { useElasticGroups } from "@/features/elasticGroups/hooks";
import { useElasticMutations } from "./hooks";
import { BulkResult, elasticService } from "./api";
import { prefillState } from "./prefill";
import { Elastic } from "./types";

// ══════════════════════════════════════════════════════════════════
//  ACTING ON THE ELASTICS TICKED IN THE LIST
//
//  Create  — start something new with them: an order, a quotation, a
//            challan, a group (or add them to one), a restock order.
//            The form opens filled in, to finish and save there.
//  Change  — price, min stock, testing parameters, warping template,
//            inactive. Run here, one result per elastic: one that
//            cannot be done says why and does not stop the others.
//  Print   — spec sheets and a price list, as PDFs for a customer.
// ══════════════════════════════════════════════════════════════════

export const MAX_COMPARE = 5;

/** The ticked elastics as a spreadsheet. */
export function elasticsCsv(rows: Elastic[]): string {
  return toCsv(
    ["Name", "Weave type", "Hooks", "Pick", "Weight (g/m)", "Stock (m)", "Reserved (m)", "Min stock (m)", "Status"],
    rows.map((e) => [
      e.name, e.weaveType ?? "", e.noOfHook ?? "", e.pick ?? "", e.weight ?? "",
      e.stock ?? 0, e.reservedStock ?? 0, e.minStock ?? 0, e.archived ? "Inactive" : "Active",
    ])
  );
}

/** Free stock (on the shelf, not promised to an order). */
export const freeStock = (e: Elastic) => Math.max(0, (e.stock ?? 0) - (e.reservedStock ?? 0));

/** What it takes to bring free stock back up to the reorder level. */
export const restockShortfall = (e: Elastic) => Math.max(0, Math.ceil((e.minStock ?? 0) - freeStock(e)));

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Dialog =
  | null | "price" | "minStock" | "archive" | "restore" | "group" | "restock"
  | "priceList" | "copyTemplate" | "testing";

function ResultDialog({ title, result, onClose }: { title: string; result: BulkResult; onClose: () => void }) {
  const refused = result.results.filter((r) => !r.ok);
  const costed = result.results.filter((r) => r.ok && r.after);
  return (
    <Modal open onClose={onClose} title={title} width="max-w-lg">
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-semibold">{result.done}</span> done
          {result.refused > 0 && <>, <span className="font-semibold text-status-danger">{result.refused}</span> not done</>}.
        </p>
        {costed.length > 0 && (
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {costed.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 tabular-nums">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-ink-600">
                  ₹{r.before?.totalCost?.toFixed(2) ?? "—"} → <span className="font-medium text-ink-900">₹{r.after!.totalCost.toFixed(2)}</span>/m
                </span>
              </li>
            ))}
          </ul>
        )}
        {refused.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-status-danger">Not done</p>
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {refused.map((r) => (
                <li key={r.id}><span className="font-medium">{r.name ?? r.id}</span> — {r.reason}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
}

function DialogButtons({ onClose, loading, disabled, label, onApply }: {
  onClose: () => void; loading?: boolean; disabled?: boolean; label: string; onApply: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
      <Button loading={loading} disabled={disabled} onClick={onApply}>{label}</Button>
    </div>
  );
}

function PriceDialog({ count, loading, onClose, onApply }: {
  count: number;
  loading: boolean;
  onClose: () => void;
  onApply: (change: { conversionCost?: number; changePercent?: number }) => void;
}) {
  const [mode, setMode] = useState<"set" | "percent" | "recost">("set");
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = mode === "recost"
    || (mode === "set" && value !== "" && Number.isFinite(n) && n >= 0 && n <= 10000)
    || (mode === "percent" && value !== "" && Number.isFinite(n) && n >= -90 && n <= 500);
  const choice = (m: typeof mode, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name="price-mode" checked={mode === m} onChange={() => { setMode(m); setValue(""); }} className="accent-brand-500" />
      {label}
    </label>
  );
  return (
    <Modal open onClose={onClose} title={`Update price of ${count} elastic${count === 1 ? "" : "s"}`} width="max-w-md">
      <div className="space-y-4">
        <p className="text-xs text-ink-400">
          An elastic&apos;s price is its cost sheet: material cost (from today&apos;s material prices)
          plus conversion cost. Each one is re-costed when you apply.
        </p>
        <div className="space-y-2">
          {choice("set", "Set conversion cost to")}
          {choice("percent", "Change conversion cost by %")}
          {choice("recost", "Only re-cost on today's material prices")}
        </div>
        {mode !== "recost" && (
          <Input
            label={mode === "set" ? "Conversion cost (₹ a metre)" : "Change (%) — negative to lower"}
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        )}
        <DialogButtons
          onClose={onClose}
          loading={loading}
          disabled={!valid}
          label={`Apply to ${count}`}
          onApply={() => onApply(mode === "set" ? { conversionCost: n } : mode === "percent" ? { changePercent: n } : {})}
        />
      </div>
    </Modal>
  );
}

function MinStockDialog({ count, loading, onClose, onApply }: {
  count: number; loading: boolean; onClose: () => void; onApply: (v: number) => void;
}) {
  const [value, setValue] = useState("");
  const n = Number(value);
  const valid = value !== "" && Number.isFinite(n) && n >= 0;
  return (
    <Modal open onClose={onClose} title={`Min stock for ${count} elastic${count === 1 ? "" : "s"}`} width="max-w-sm">
      <div className="space-y-4">
        <Input label="Min stock (m)" type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus
          hint="Stock at or under this shows as LOW. 0 turns the alert off." />
        <DialogButtons onClose={onClose} loading={loading} disabled={!valid} label={`Set for ${count}`} onApply={() => onApply(n)} />
      </div>
    </Modal>
  );
}

function AddToGroupDialog({ selected, onClose, onNewGroup }: {
  selected: Elastic[]; onClose: () => void; onNewGroup: () => void;
}) {
  const { toast } = useToast();
  const groups = useElasticGroups();
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const options = (groups.data ?? []).map((g) => ({
    value: g._id,
    label: `${g.name}${g.customer?.name ? ` — ${g.customer.name}` : ""} (${g.items.length})`,
  }));
  const add = async () => {
    setBusy(true);
    try {
      const r = await elasticGroupService.addElastics(groupId, selected.map((e) => e._id));
      toast(
        `Added ${r.added} to "${r.group.name}"${r.alreadyThere ? ` — ${r.alreadyThere} already in it` : ""}`,
        "success"
      );
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not add to the group", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Add ${selected.length} to a group`} width="max-w-md">
      <div className="space-y-4">
        <Select
          label="Group"
          placeholder={groups.isLoading ? "Loading…" : "Choose a group"}
          options={options}
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        />
        <p className="text-xs text-ink-400">
          Elastics already in it stay as they are, default quantities and all. A group is also how a
          customer&apos;s usual elastics are kept, ready to fill an order.
        </p>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onNewGroup}><Plus className="h-4 w-4" /> New group instead</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button loading={busy} disabled={!groupId} onClick={add}>Add to group</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RestockDialog({ selected, onClose }: { selected: Elastic[]; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [qty, setQty] = useState<Record<string, string>>(
    () => Object.fromEntries(selected.map((e) => [e._id, String(restockShortfall(e) || "")]))
  );
  const [busy, setBusy] = useState(false);
  const lines = selected
    .map((e) => ({ elastic: e._id, quantity: Math.round(Number(qty[e._id])) }))
    .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0);
  const raise = async () => {
    setBusy(true);
    try {
      const r = await orderService.restock(lines);
      toast("Restock order raised — approve it and raise its job", "success");
      onClose();
      navigate(`/orders/${r.orderId}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not raise the restock order", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Restock" width="max-w-lg">
      <div className="space-y-3">
        <p className="text-xs text-ink-400">
          Raises an order for your own stock. Approve it and raise its job as for any order; when it
          completes, the metres are free stock. Suggested: enough to bring free stock back to the
          reorder level.
        </p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {selected.map((e) => (
            <div key={e._id} className="grid grid-cols-[1fr_auto_110px] items-center gap-3 text-sm">
              <span className="truncate font-medium">{e.name}</span>
              <span className="text-xs tabular-nums text-ink-400">free {freeStock(e).toLocaleString("en-IN")} · min {(e.minStock ?? 0).toLocaleString("en-IN")}</span>
              <Input
                aria-label={`Metres to make of ${e.name}`}
                type="number"
                value={qty[e._id]}
                onChange={(ev) => setQty((q) => ({ ...q, [e._id]: ev.target.value }))}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <DialogButtons onClose={onClose} loading={busy} disabled={lines.length === 0}
          label={`Raise restock order (${lines.length})`} onApply={raise} />
      </div>
    </Modal>
  );
}

function PriceListDialog({ selected, onClose }: { selected: Elastic[]; onClose: () => void }) {
  const { toast } = useToast();
  const [margin, setMargin] = useState("20");
  const [customerName, setCustomerName] = useState("");
  const [gst, setGst] = useState("5");
  const [validDays, setValidDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const m = Number(margin);
  const valid = margin !== "" && Number.isFinite(m) && m >= 0 && m <= 500;
  const make = async () => {
    setBusy(true);
    try {
      const blob = await elasticService.priceListPdf(selected.map((e) => e._id), {
        marginPercent: m,
        customerName: customerName.trim() || undefined,
        gstPercent: gst === "" ? null : Number(gst),
        validDays: Number(validDays) || 30,
      });
      saveBlob(blob, `price-list-${new Date().toISOString().slice(0, 10)}.pdf`);
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not make the price list", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Price list for ${selected.length}`} width="max-w-md">
      <div className="space-y-3">
        <p className="text-xs text-ink-400">Rate a metre = the cost sheet&apos;s total plus your margin. No cost is printed.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Margin (%)" type="number" value={margin} onChange={(e) => setMargin(e.target.value)} />
          <Input label="GST (%)" type="number" value={gst} onChange={(e) => setGst(e.target.value)} />
          <Input label="For (customer)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="All customers" />
          <Input label="Valid for (days)" type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} />
        </div>
        <DialogButtons onClose={onClose} loading={busy} disabled={!valid} label="Make PDF" onApply={make} />
      </div>
    </Modal>
  );
}

function CopyTemplateDialog({ selected, loading, onClose, onApply }: {
  selected: Elastic[]; loading: boolean; onClose: () => void;
  onApply: (sourceId: string, ids: string[], replace: boolean) => void;
}) {
  const sources = selected.filter((e) => (e.warpingPlanTemplate?.beams?.length ?? 0) > 0);
  const [sourceId, setSourceId] = useState(sources[0]?._id ?? "");
  const [replace, setReplace] = useState(false);
  const targets = selected.filter((e) => e._id !== sourceId);
  return (
    <Modal open onClose={onClose} title="Copy warping template" width="max-w-md">
      <div className="space-y-3">
        <Select
          label="Copy from"
          options={sources.map((e) => ({ value: e._id, label: e.name }))}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        />
        <p className="text-xs text-ink-400">
          Onto the other {targets.length} selected. Only an elastic that uses every warp yarn in the
          template takes it; any other is listed afterwards.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-brand-500" />
          Replace templates they already have
        </label>
        <DialogButtons onClose={onClose} loading={loading} disabled={!sourceId || targets.length === 0}
          label={`Copy to ${targets.length}`} onApply={() => onApply(sourceId, targets.map((e) => e._id), replace)} />
      </div>
    </Modal>
  );
}

function TestingDialog({ count, loading, onClose, onApply }: {
  count: number; loading: boolean; onClose: () => void;
  onApply: (p: { width?: number; elongation?: number; recovery?: number; strech?: string }) => void;
}) {
  const [width, setWidth] = useState("");
  const [elongation, setElongation] = useState("");
  const [recovery, setRecovery] = useState("");
  const [strech, setStrech] = useState("");
  const params = {
    ...(width !== "" ? { width: Number(width) } : {}),
    ...(elongation !== "" ? { elongation: Number(elongation) } : {}),
    ...(recovery !== "" ? { recovery: Number(recovery) } : {}),
    ...(strech.trim() ? { strech: strech.trim() } : {}),
  };
  const valid = Object.keys(params).length > 0
    && Object.values(params).every((v) => typeof v === "string" || (Number.isFinite(v) && v >= 0))
    && (params.recovery === undefined || params.recovery <= 100);
  return (
    <Modal open onClose={onClose} title={`Testing parameters for ${count}`} width="max-w-md">
      <div className="space-y-3">
        <p className="text-xs text-ink-400">Only what you fill in is set; blanks leave each elastic as it is.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Width (mm)" type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
          <Input label="Elongation (%)" type="number" value={elongation} onChange={(e) => setElongation(e.target.value)} />
          <Input label="Recovery (%)" type="number" value={recovery} onChange={(e) => setRecovery(e.target.value)} />
          <Input label="Stretch" value={strech} onChange={(e) => setStrech(e.target.value)} placeholder="e.g. firm" />
        </div>
        <DialogButtons onClose={onClose} loading={loading} disabled={!valid} label={`Set for ${count}`} onApply={() => onApply(params)} />
      </div>
    </Modal>
  );
}

export function ElasticBulkActions({ selected, onClear }: { selected: Elastic[]; onClear: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { bulkArchive, bulkCosting, bulkMinStock, bulkCopyTemplate, bulkTesting } = useElasticMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [result, setResult] = useState<{ title: string; result: BulkResult } | null>(null);
  const [printing, setPrinting] = useState(false);

  const ids = selected.map((e) => e._id);
  const canChange = user?.role === "admin" || user?.role === "accounts";
  const can = (path: string) => canAccessPath(path, user);
  const active = selected.filter((e) => !e.archived);
  const inactive = selected.filter((e) => e.archived);
  const withTemplate = selected.filter((e) => (e.warpingPlanTemplate?.beams?.length ?? 0) > 0);
  const n = selected.length;

  const finish = (title: string) => ({
    onSuccess: (r: BulkResult) => {
      setDialog(null);
      if (r.refused === 0 && !r.results.some((x) => x.after)) toast(`${title}: ${r.done} done`, "success");
      else setResult({ title, result: r });
    },
    onError: (e: unknown) => {
      setDialog(null);
      toast(e instanceof ApiError ? e.message : `${title} failed`, "error");
    },
  });

  const startWith = (path: string) => navigate(path, { state: prefillState(selected) });

  const specSheets = async () => {
    setPrinting(true);
    try {
      saveBlob(await elasticService.specSheetPdf(ids), `specifications-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not make the spec sheets", "error");
    } finally {
      setPrinting(false);
    }
  };

  const create: ActionMenuItem[] = [
    ...(can("/orders") ? [{ label: "New order", icon: <ShoppingCart className="h-4 w-4" />, onSelect: () => startWith("/orders") }] : []),
    ...(can("/quotes") ? [{ label: "New quotation", icon: <FileText className="h-4 w-4" />, onSelect: () => startWith("/quotes/new") }] : []),
    ...(can("/delivery-challans") ? [{ label: "New DC", icon: <Truck className="h-4 w-4" />, onSelect: () => startWith("/delivery-challans") }] : []),
    ...(can("/elastic-groups") ? [
      { label: "New group", icon: <Layers className="h-4 w-4" />, onSelect: () => startWith("/elastic-groups") },
      { label: "Add to a group…", icon: <Plus className="h-4 w-4" />, onSelect: () => setDialog("group") },
    ] : []),
    ...(can("/orders") ? [{
      label: "Restock (order for own stock)…", icon: <PackagePlus className="h-4 w-4" />, onSelect: () => setDialog("restock"),
      hint: "Suggests enough to reach each reorder level",
    }] : []),
  ];

  const change: ActionMenuItem[] = canChange ? [
    { label: "Update price…", icon: <IndianRupee className="h-4 w-4" />, onSelect: () => setDialog("price") },
    { label: "Min stock…", icon: <Warehouse className="h-4 w-4" />, onSelect: () => setDialog("minStock") },
    { label: "Testing parameters…", icon: <FlaskConical className="h-4 w-4" />, onSelect: () => setDialog("testing") },
    {
      label: "Copy warping template…", icon: <Copy className="h-4 w-4" />, onSelect: () => setDialog("copyTemplate"),
      disabled: withTemplate.length === 0 || n < 2,
      hint: withTemplate.length === 0 ? "None of these has a template to copy" : n < 2 ? "Select the elastics to copy it to" : undefined,
    },
    ...(active.length ? [{ label: `Inactivate (${active.length})`, icon: <Archive className="h-4 w-4" />, onSelect: () => setDialog("archive") }] : []),
    ...(inactive.length ? [{ label: `Reactivate (${inactive.length})`, icon: <ArchiveRestore className="h-4 w-4" />, onSelect: () => setDialog("restore") }] : []),
  ] : [];

  const print: ActionMenuItem[] = [
    { label: "Spec sheets (PDF)", icon: <FileText className="h-4 w-4" />, onSelect: specSheets, disabled: printing },
    ...(canChange ? [{ label: "Price list (PDF)…", icon: <IndianRupee className="h-4 w-4" />, onSelect: () => setDialog("priceList") }] : []),
    {
      label: "Export CSV", icon: <FileSpreadsheet className="h-4 w-4" />,
      onSelect: () => downloadCsv(`elastics-${new Date().toISOString().slice(0, 10)}.csv`, elasticsCsv(selected)),
    },
  ];

  return (
    <>
      <div
        role="toolbar"
        aria-label="Actions on the selected elastics"
        className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-card border border-brand-500/30 bg-brand-50 px-3 py-2"
      >
        <span className="text-sm font-semibold tabular-nums">{n} selected</span>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900">
          <X className="h-3.5 w-3.5" /> Clear
        </button>
        <span className="mx-1 hidden h-5 w-px bg-ink-200 sm:block" />
        <ActionMenu label="Create" icon={<Plus className="h-4 w-4" />} items={create} />
        <ActionMenu label="Change" icon={<Pencil className="h-4 w-4" />} items={change} />
        <ActionMenu label="Print" icon={<Printer className="h-4 w-4" />} items={print} />
        <Button
          size="sm"
          variant="secondary"
          disabled={n < 2 || n > MAX_COMPARE}
          title={n < 2 || n > MAX_COMPARE ? `Select 2 to ${MAX_COMPARE} to compare` : undefined}
          onClick={() => navigate(`/elastics/compare?ids=${ids.join(",")}`)}
        >
          <Columns3 className="h-4 w-4" /> Compare
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => downloadCsv(`elastics-${new Date().toISOString().slice(0, 10)}.csv`, elasticsCsv(selected))}
          aria-label="Export CSV"
          className="hidden sm:inline-flex"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {dialog === "price" && (
        <PriceDialog count={n} loading={bulkCosting.isPending} onClose={() => setDialog(null)}
          onApply={(change) => bulkCosting.mutate({ ids, change }, finish("Price update"))} />
      )}
      {dialog === "minStock" && (
        <MinStockDialog count={n} loading={bulkMinStock.isPending} onClose={() => setDialog(null)}
          onApply={(minStock) => bulkMinStock.mutate({ ids, minStock }, finish("Min stock"))} />
      )}
      {dialog === "testing" && (
        <TestingDialog count={n} loading={bulkTesting.isPending} onClose={() => setDialog(null)}
          onApply={(params) => bulkTesting.mutate({ ids, params }, finish("Testing parameters"))} />
      )}
      {dialog === "copyTemplate" && (
        <CopyTemplateDialog selected={selected} loading={bulkCopyTemplate.isPending} onClose={() => setDialog(null)}
          onApply={(sourceId, targets, replace) => bulkCopyTemplate.mutate({ sourceId, ids: targets, replace }, finish("Copy warping template"))} />
      )}
      {dialog === "group" && (
        <AddToGroupDialog selected={selected} onClose={() => setDialog(null)}
          onNewGroup={() => { setDialog(null); startWith("/elastic-groups"); }} />
      )}
      {dialog === "restock" && <RestockDialog selected={selected} onClose={() => setDialog(null)} />}
      {dialog === "priceList" && <PriceListDialog selected={selected} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "archive"}
        title={`Inactivate ${active.length} elastic${active.length === 1 ? "" : "s"}?`}
        message="They drop out of lists and pickers; nothing is deleted, and they can be reactivated. Any with stock reserved against an approved order is left active, and listed."
        confirmLabel="Inactivate"
        danger
        loading={bulkArchive.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => bulkArchive.mutate({ ids: active.map((e) => e._id), archived: true }, finish("Inactivate"))}
      />
      <ConfirmDialog
        open={dialog === "restore"}
        title={`Reactivate ${inactive.length} elastic${inactive.length === 1 ? "" : "s"}?`}
        message="They come back into lists and pickers."
        confirmLabel="Reactivate"
        loading={bulkArchive.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => bulkArchive.mutate({ ids: inactive.map((e) => e._id), archived: false }, finish("Reactivate"))}
      />
      {result && <ResultDialog title={result.title} result={result.result} onClose={() => setResult(null)} />}
    </>
  );
}
