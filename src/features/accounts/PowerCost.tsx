import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileScan, PencilLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import { PaperChecks, PaperPicker, ReadProblem } from "./PaperReader";
import type { PowerBillDraft, PowerBillResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  POWER COST PER METRE
//
//  The month's electricity bill, read from its photo or PDF (or typed),
//  set against the metres woven that month (closed shift entries): power
//  cost per metre and units per metre, and how each moved on the month
//  before. One bill a month for each service connection.
// ══════════════════════════════════════════════════════════════════

const monthName = (m: string) => { const [y, mm] = m.split("-").map(Number); return new Date(y, mm - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" }); };
const th = "py-2 text-xs font-medium uppercase tracking-wide text-ink-400";
const num = "py-2 text-right tabular-nums";

export function PowerCost() {
  const qc = useQueryClient();
  const report = useQuery({ queryKey: [ACCOUNTS_KEY, "power-cost"], queryFn: () => accountsService.powerCost(12) });
  const [dialog, setDialog] = useState<"read" | "type" | null>(null);
  const rows = report.data ?? [];
  // The month still running has only some of its metres: the line under the title speaks of the last month over.
  const latest = rows.find((r) => !r.partial);
  return (
    <Card className="p-5" aria-label="Power cost per metre">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Power cost per metre</h3>
          <p className="text-sm text-ink-500">Each month's electricity bill against the metres woven that month (closed shift entries).{latest?.costPerMetre != null ? <> {monthName(latest.month)}: <strong>₹{money(latest.costPerMetre)} a metre</strong>, {latest.unitsPerMetre} units a metre.</> : null}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialog("type")}><PencilLine className="h-4 w-4" aria-hidden /> Type it in</Button>
          <Button onClick={() => setDialog("read")}><FileScan className="h-4 w-4" aria-hidden /> Read the electricity bill</Button>
        </div>
      </div>
      {report.isLoading ? <Skeleton className="mt-3 h-32 w-full" /> : rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">No electricity bill kept yet. Read this month's bill to start.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" aria-label="Power cost by month">
            <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Month</th><th className={`${th} text-right`}>Units</th><th className={`${th} text-right`}>Bill (₹)</th><th className={`${th} text-right`}>₹ a unit</th><th className={`${th} text-right`}>Metres woven</th><th className={`${th} text-right`}>₹ a metre</th><th className={`${th} text-right`}>Units a metre</th><th className={`${th} text-right`}>On the month before</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="py-2 whitespace-nowrap">{monthName(r.month)}{r.bills.length > 1 && <span className="block text-xs text-ink-400">{r.bills.length} connections</span>}</td>
                  <td className={num}>{r.units.toLocaleString("en-IN")}</td>
                  <td className={num}>{money(r.total)}</td>
                  <td className={num}>{r.ratePerUnit != null ? money(r.ratePerUnit) : "—"}</td>
                  <td className={num}>{r.metres ? r.metres.toLocaleString("en-IN") : <span className="text-ink-400" title="No closed shift entries this month">none entered</span>}{r.partial && <span className="block text-xs text-status-warning">month not over</span>}</td>
                  <td className={`${num} ${r.partial ? "text-ink-400" : "font-medium"}`} title={r.partial ? "Only some of this month's metres are woven yet" : undefined}>{r.costPerMetre != null ? money(r.costPerMetre) : "—"}</td>
                  <td className={num}>{r.unitsPerMetre ?? "—"}</td>
                  <td className="py-2 text-right">{r.change == null ? <span className="text-ink-400">—</span> : <StatusChip tone={r.change > 2 ? "danger" : r.change < -2 ? "success" : "neutral"}>{r.change > 0 ? "+" : ""}{r.change}%</StatusChip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && <PowerBillDialog read={dialog === "read"} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "power-cost"] }); }} />}
    </Card>
  );
}

const blank: PowerBillDraft = { month: "", consumerNo: "", billNo: "", billDate: null, periodFrom: null, periodTo: null, units: null, demandKva: null, energyCharges: null, demandCharges: null, otherCharges: null, tax: null, total: null, dueDate: null, ratePerUnit: null };
type NumKey = "units" | "total" | "energyCharges" | "demandCharges" | "otherCharges" | "tax";

function PowerBillDialog({ read: reading, onClose, onSaved }: { read: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<PowerBillResult | null>(null);
  const [f, setF] = useState<PowerBillDraft>(blank);
  const showForm = !reading || (!!result && !result.read.problem);

  const read = async (files: File[]) => {
    setBusy(true);
    try {
      const r = await accountsService.readPowerBill(files);
      setResult(r);
      if (r.draft) setF(r.draft);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not read the electricity bill", "error"); }
    finally { setBusy(false); }
  };
  const setNum = (k: NumKey) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value === "" ? null : Number(e.target.value) }));
  const ready = /^\d{4}-\d{2}$/.test(f.month) && Number(f.units) > 0 && Number(f.total) > 0;
  const rate = Number(f.units) > 0 && Number(f.total) > 0 ? Math.round((Number(f.total) / Number(f.units)) * 100) / 100 : null;

  const save = async () => {
    setSaving(true);
    try {
      const { ratePerUnit: _rate, ...body } = f;
      await accountsService.savePowerBill({ ...body, month: f.month, units: Number(f.units), total: Number(f.total), aiSuggestion: result?.aiSuggestion ?? undefined });
      toast(`The ${monthName(f.month)} bill is kept`, "success");
      onSaved();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not keep the bill", "error"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={reading ? "Read the electricity bill" : "The month's electricity bill"} width="max-w-xl" confirmDirtyClose={false}>
      <div className="space-y-4">
        {reading && !result && (
          <>
            <p className="text-sm text-ink-600">The month's bill from TNPDCL: a photo or the PDF, up to three pages. The units, the charges and the period are read; the month it is for is the period's end.</p>
            <PaperPicker label="Electricity bill photo" max={3} busy={busy} onFiles={read} />
          </>
        )}
        {result?.read.problem && <ReadProblem>{result.read.problem === "not_a_power_bill" ? "That does not look like an electricity bill." : "The bill could not be read. Try a sharper photo, or type it in."}</ReadProblem>}
        {result && <PaperChecks checks={result.checks} label="Checks on the bill" />}
        {result?.duplicate && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">The bill for this month and connection is kept already: ₹{money(result.duplicate.total)} for {result.duplicate.units.toLocaleString("en-IN")} units.</p>}
        {showForm && (
          <div className="space-y-3" aria-label="The bill's figures">
            <div className="grid grid-cols-2 gap-3">
              <Input label="For month *" type="month" value={f.month} onChange={(e) => setF((x) => ({ ...x, month: e.target.value }))} />
              <Input label="Service connection no." value={f.consumerNo} onChange={(e) => setF((x) => ({ ...x, consumerNo: e.target.value }))} />
              <Input label="Units (kWh) *" type="number" min={0} step="0.01" value={f.units ?? ""} onChange={setNum("units")} />
              <Input label="Total payable (₹) *" type="number" min={0} step="0.01" value={f.total ?? ""} onChange={setNum("total")} />
              <Input label="Energy charges (₹)" type="number" min={0} step="0.01" value={f.energyCharges ?? ""} onChange={setNum("energyCharges")} />
              <Input label="Demand charges (₹)" type="number" min={0} step="0.01" value={f.demandCharges ?? ""} onChange={setNum("demandCharges")} />
              <Input label="Other charges (₹)" type="number" min={0} step="0.01" value={f.otherCharges ?? ""} onChange={setNum("otherCharges")} />
              <Input label="Electricity tax (₹)" type="number" min={0} step="0.01" value={f.tax ?? ""} onChange={setNum("tax")} />
            </div>
            {rate != null && <p className="text-sm text-ink-500">₹{money(rate)} a unit.</p>}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {reading && <Button variant="secondary" onClick={() => { setResult(null); setF(blank); }}>Read another</Button>}
              <Button onClick={save} disabled={!ready || !!result?.duplicate} loading={saving}>Keep the bill</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
