import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, Download, IndianRupee, Layers, ShoppingCart, Truck, Warehouse, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { canAccessPath } from "@/app/navigation";
import { downloadCsv, toCsv } from "@/core/format/csv";
import { useElasticMutations } from "./hooks";
import { BulkResult } from "./api";
import { prefillState } from "./prefill";
import { Elastic } from "./types";

// ══════════════════════════════════════════════════════════════════
//  ACTING ON THE ELASTICS TICKED IN THE LIST
//
//  Two kinds of action. Starting something new with them (an order, a
//  group, a challan) opens that page's ordinary form already filled in,
//  to finish and save there. Changing them (price, min stock, inactive)
//  runs here, one result per elastic: one that cannot be done says why
//  and does not stop the others.
// ══════════════════════════════════════════════════════════════════

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

type Dialog = null | "price" | "minStock" | "archive" | "restore";

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
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            loading={loading}
            disabled={!valid}
            onClick={() => onApply(mode === "set" ? { conversionCost: n } : mode === "percent" ? { changePercent: n } : {})}
          >
            Apply to {count}
          </Button>
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
  const valid = value !== "" && Number.isFinite(n) && n >= 0;
  return (
    <Modal open onClose={onClose} title={`Min stock for ${count} elastic${count === 1 ? "" : "s"}`} width="max-w-sm">
      <div className="space-y-4">
        <Input label="Min stock (m)" type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus
          hint="Stock at or under this shows as LOW. 0 turns the alert off." />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button loading={loading} disabled={!valid} onClick={() => onApply(n)}>Set for {count}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function ElasticBulkActions({ selected, onClear }: { selected: Elastic[]; onClear: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { bulkArchive, bulkCosting, bulkMinStock } = useElasticMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [result, setResult] = useState<{ title: string; result: BulkResult } | null>(null);

  const ids = selected.map((e) => e._id);
  const canChange = user?.role === "admin" || user?.role === "accounts";
  const active = selected.filter((e) => !e.archived);
  const inactive = selected.filter((e) => e.archived);
  const n = selected.length;

  const finish = (title: string) => ({
    onSuccess: (r: BulkResult) => {
      setDialog(null);
      if (r.refused === 0 && !r.results.some((x) => x.after)) {
        toast(`${title}: ${r.done} done`, "success");
      } else {
        setResult({ title, result: r });
      }
    },
    onError: (e: unknown) => {
      setDialog(null);
      toast(e instanceof ApiError ? e.message : `${title} failed`, "error");
    },
  });

  const startWith = (path: string) => navigate(path, { state: prefillState(selected) });

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

        {canAccessPath("/orders", user) && (
          <Button size="sm" variant="secondary" onClick={() => startWith("/orders")}>
            <ShoppingCart className="h-4 w-4" /> New order
          </Button>
        )}
        {canAccessPath("/elastic-groups", user) && (
          <Button size="sm" variant="secondary" onClick={() => startWith("/elastic-groups")}>
            <Layers className="h-4 w-4" /> New group
          </Button>
        )}
        {canAccessPath("/delivery-challans", user) && (
          <Button size="sm" variant="secondary" onClick={() => startWith("/delivery-challans")}>
            <Truck className="h-4 w-4" /> New DC
          </Button>
        )}

        {canChange && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setDialog("price")}>
              <IndianRupee className="h-4 w-4" /> Update price
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog("minStock")}>
              <Warehouse className="h-4 w-4" /> Min stock
            </Button>
            {active.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setDialog("archive")}>
                <Archive className="h-4 w-4" /> Inactivate
              </Button>
            )}
            {inactive.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setDialog("restore")}>
                <ArchiveRestore className="h-4 w-4" /> Reactivate
              </Button>
            )}
          </>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => downloadCsv(`elastics-${new Date().toISOString().slice(0, 10)}.csv`, elasticsCsv(selected))}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {dialog === "price" && (
        <PriceDialog
          count={n}
          loading={bulkCosting.isPending}
          onClose={() => setDialog(null)}
          onApply={(change) => bulkCosting.mutate({ ids, change }, finish("Price update"))}
        />
      )}
      {dialog === "minStock" && (
        <MinStockDialog
          count={n}
          loading={bulkMinStock.isPending}
          onClose={() => setDialog(null)}
          onApply={(minStock) => bulkMinStock.mutate({ ids, minStock }, finish("Min stock"))}
        />
      )}
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
