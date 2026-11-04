import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { FormScreen } from "@/components/ui/FormScreen";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useCategories } from "./hooks";
import { money, today, RangePicker, defaultPeriod } from "./shared";
import { ChequesSection, ConfirmationsSection, InterestSection } from "./PartyRegisters";
import type { AssetBlock, FixedAssetBody, FixedAssetRow, BudgetRow } from "./types";

type Section = "assets" | "stock" | "budgets" | "costcentres" | "cheques" | "confirmations" | "interest" | "sales" | "purchase";
const SECTIONS: Section[] = ["assets", "stock", "budgets", "costcentres", "cheques", "confirmations", "interest", "sales", "purchase"];
export const thisFy = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };
const fyOptions = () => { const y = Number(thisFy().slice(0, 4)); return [y + 1, y, y - 1, y - 2, y - 3].map((x) => `${x}-${String(x + 1).slice(2)}`); };
export const th = "py-2 text-xs font-medium uppercase tracking-wide text-ink-400";
export const num = "py-2 text-right tabular-nums";

/**
 * The registers an auditor asks for: fixed assets and their depreciation,
 * the closing stock, budgets against actual, cost centres, cheques in
 * hand, balance confirmations, interest on overdue invoices, and the
 * sales and purchase registers.
 */
export function RegistersTab() {
  const [params] = useSearchParams();
  const asked = params.get("section") as Section | null;
  const [section, setSection] = useState<Section>(asked && SECTIONS.includes(asked) ? asked : "assets");
  const [fy, setFy] = useState(/^\d{4}-\d{2}$/.test(params.get("fy") ?? "") ? params.get("fy")! : thisFy());
  const yearly = section === "assets" || section === "budgets";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips options={[{ value: "assets", label: "Fixed assets" }, { value: "stock", label: "Closing stock" }, { value: "budgets", label: "Budgets" }, { value: "costcentres", label: "Cost centres" }, { value: "cheques", label: "Cheques" }, { value: "confirmations", label: "Balance confirmations" }, { value: "interest", label: "Interest on overdue" }, { value: "sales", label: "Sales register" }, { value: "purchase", label: "Purchase register" }]} value={section} onChange={setSection} />
        {yearly && <Select label="Year" value={fy} onChange={(e) => setFy(e.target.value)} options={fyOptions().map((f) => ({ value: f, label: f }))} />}
      </div>
      {section === "assets" && <FixedAssetsSection fy={fy} />}
      {section === "stock" && <ClosingStockSection />}
      {section === "budgets" && <BudgetsSection fy={fy} />}
      {section === "costcentres" && <CostCentresSection />}
      {section === "cheques" && <ChequesSection />}
      {section === "confirmations" && <ConfirmationsSection />}
      {section === "interest" && <InterestSection />}
      {(section === "sales" || section === "purchase") && <RegisterSection kind={section} />}
    </div>
  );
}

// ── Fixed assets ─────────────────────────────────────────────────────
function AssetForm({ blocks, onDone, onCancel }: { blocks: Array<{ key: AssetBlock; label: string; itRate: number; life: number }>; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<FixedAssetBody>({ name: "", block: "plant", method: "wdv", residualPercent: 5, lifeYears: "", purchaseDate: today(), putToUse: today(), cost: 0, location: "", identifier: "", supplierName: "" });
  const [opening, setOpening] = useState<{ fy: string; companiesAct: number | ""; incomeTax: number | "" }>({ fy: "", companiesAct: "", incomeTax: "" });
  const [busy, setBusy] = useState(false);
  const block = blocks.find((b) => b.key === f.block);
  const set = (patch: Partial<FixedAssetBody>) => setF((x) => ({ ...x, ...patch }));
  const save = async () => {
    setBusy(true);
    try {
      await accountsService.addFixedAsset({ ...f, lifeYears: f.lifeYears === "" ? undefined : Number(f.lifeYears), ...(opening.fy && opening.companiesAct !== "" ? { openingWdv: { fy: opening.fy, companiesAct: Number(opening.companiesAct), incomeTax: opening.incomeTax === "" ? undefined : Number(opening.incomeTax) } } : {}) });
      toast(`${f.name} added to the register`, "success"); onDone();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not add the asset", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Asset *" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Needle loom 12, Compressor, Office PC" />
        <Select label="Block *" value={f.block} onChange={(e) => set({ block: e.target.value as AssetBlock })} options={blocks.map((b) => ({ value: b.key, label: `${b.label} · IT ${b.itRate}% · ${b.life} yrs` }))} />
        <Input label="Cost capitalised (₹) *" type="number" min={0} step="0.01" value={f.cost || ""} onChange={(e) => set({ cost: Number(e.target.value) || 0 })} hint="Price, freight, installation, GST not claimed" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bought on" type="date" value={f.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value, putToUse: f.putToUse && f.putToUse < e.target.value ? e.target.value : f.putToUse })} />
          <Input label="Put to use" type="date" value={f.putToUse} onChange={(e) => set({ putToUse: e.target.value })} hint="Depreciation runs from here" />
        </div>
        <Select label="Companies Act method" value={f.method} onChange={(e) => set({ method: e.target.value as "wdv" | "slm" })} options={[{ value: "wdv", label: "Written-down value" }, { value: "slm", label: "Straight line" }]} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Residual %" type="number" min={0} max={50} value={f.residualPercent} onChange={(e) => set({ residualPercent: Number(e.target.value) || 0 })} />
          <Input label="Useful life (yrs)" type="number" min={1} max={100} value={f.lifeYears ?? ""} placeholder={block ? String(block.life) : ""} onChange={(e) => set({ lifeYears: e.target.value === "" ? "" : Number(e.target.value) })} hint="Blank: Schedule II" />
        </div>
        <Input label="Supplier" value={f.supplierName ?? ""} onChange={(e) => set({ supplierName: e.target.value })} />
        <Input label="Serial / registration no." value={f.identifier ?? ""} onChange={(e) => set({ identifier: e.target.value })} />
        <Input label="Where it is" value={f.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="Weaving shed, Office" />
        <Input label="Notes" value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <details className="rounded-lg border border-ink-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium">Bought before these books began? Enter the opening written-down values</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Input label="As at the start of" value={opening.fy} onChange={(e) => setOpening({ ...opening, fy: e.target.value })} placeholder="2026-27" />
          <Input label="WDV, Companies Act (₹)" type="number" min={0} value={opening.companiesAct} onChange={(e) => setOpening({ ...opening, companiesAct: e.target.value === "" ? "" : Number(e.target.value) })} />
          <Input label="WDV, Income-tax (₹)" type="number" min={0} value={opening.incomeTax} onChange={(e) => setOpening({ ...opening, incomeTax: e.target.value === "" ? "" : Number(e.target.value) })} hint="Blank: same as Companies Act" />
        </div>
      </details>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button disabled={f.name.trim().length < 2 || !(f.cost > 0) || !f.purchaseDate} loading={busy} onClick={save}>Add asset</Button>
      </div>
    </div>
  );
}

function DisposeForm({ asset, onDone, onCancel }: { asset: FixedAssetRow; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [how, setHow] = useState<"sold" | "scrapped">("sold");
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await accountsService.disposeFixedAsset(asset._id, { how, date, amount: how === "sold" ? Number(amount) || 0 : 0, reason }); toast(`${asset.name} ${how}${r.year.disposal ? ` — ${r.year.disposal.gainLoss >= 0 ? "gain" : "loss"} ₹${money(Math.abs(r.year.disposal.gainLoss))} against the written-down value` : ""}`, "success"); onDone(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not record it", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">{asset.assetNo} · {asset.name} · written-down value ₹{money(asset.year.companiesAct.closing)} at the end of {asset.year.fy}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="How" value={how} onChange={(e) => setHow(e.target.value as "sold" | "scrapped")} options={[{ value: "sold", label: "Sold" }, { value: "scrapped", label: "Scrapped / written off" }]} />
        <Input label="On" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {how === "sold" && <Input label="Sold for (₹)" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />}
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Replaced, beyond repair…" />
      </div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button loading={busy} onClick={save}>Record</Button></div>
    </div>
  );
}

function FixedAssetsSection({ fy }: { fy: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "fixed-assets", fy], queryFn: () => accountsService.fixedAssets(fy) });
  const [adding, setAdding] = useState(false);
  const [disposing, setDisposing] = useState<FixedAssetRow | null>(null);
  const [posting, setPosting] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "fixed-assets"] });
  const post = async () => {
    setPosting(true);
    try { const r = await accountsService.postDepreciation(fy); qc.setQueryData([ACCOUNTS_KEY, "fixed-assets", fy], r.register); toast(`${r.journal.journalNo} posted: depreciation ₹${money(r.journal.total)} for ${fy}`, "success"); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "journals"] }); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not post it", "error"); }
    finally { setPosting(false); }
  };
  if (q.isLoading || !q.data) return <Skeleton className="h-64 w-full" />;
  const r = q.data;
  return (
    <div className="space-y-4">
      <FormScreen open={adding} onClose={() => setAdding(false)} title="Add a fixed asset" width="max-w-3xl">{adding && <AssetForm blocks={r.blockTable} onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}</FormScreen>
      <FormScreen open={!!disposing} onClose={() => setDisposing(null)} title="Sold or scrapped" width="max-w-lg">{disposing && <DisposeForm asset={disposing} onDone={() => { setDisposing(null); refresh(); }} onCancel={() => setDisposing(null)} />}</FormScreen>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">Fixed assets · {fy}</h3>
            <p className="text-sm text-ink-500">{r.rows.length} asset{r.rows.length === 1 ? "" : "s"} · cost ₹{money(r.totals.cost)}{r.totals.additions ? ` · added this year ₹${money(r.totals.additions)}` : ""}{r.totals.disposals ? ` · disposals ₹${money(r.totals.disposals)}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={accountsService.fixedAssetsXlsxUrl(fy)} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><Download className="h-4 w-4" /> Register (Excel)</a>
            <Button variant="secondary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add asset</Button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-ink-50 p-3 text-sm"><p className="text-xs text-ink-400">Depreciation · Companies Act (Sch. II)</p><p className="text-lg font-semibold tabular-nums">₹{money(r.totals.caDep)}</p><p className="text-xs text-ink-500">WDV ₹{money(r.totals.caOpening)} → ₹{money(r.totals.caClosing)}</p></div>
          <div className="rounded-lg bg-ink-50 p-3 text-sm"><p className="text-xs text-ink-400">Depreciation · Income-tax (s.32)</p><p className="text-lg font-semibold tabular-nums">₹{money(r.totals.itDep)}</p><p className="text-xs text-ink-500">Block WDV ₹{money(r.totals.itOpening)} → ₹{money(r.totals.itClosing)}</p></div>
          <div className="rounded-lg bg-ink-50 p-3 text-sm"><p className="text-xs text-ink-400">Timing difference (deferred tax base)</p><p className="text-lg font-semibold tabular-nums">₹{money(r.timingDifference)}</p><p className="text-xs text-ink-500">Book depreciation less tax depreciation</p></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {r.journal ? <StatusChip tone={r.journalStale ? "warning" : "success"}>{r.journal.journalNo} · ₹{money(r.journal.total)}{r.journalStale ? " · stale, post again" : ""}</StatusChip> : <StatusChip tone="neutral">Depreciation not posted for {fy}</StatusChip>}
          <Button size="sm" variant="secondary" loading={posting} disabled={!(r.totals.caDep > 0)} onClick={post}>{r.journal ? "Post again" : "Post depreciation journal"}</Button>
          <span className="text-xs text-ink-400">Dr Depreciation · Cr Accumulated Depreciation, dated 31 March</span>
        </div>
      </Card>
      <Card className="p-5">
        {r.rows.length === 0 && <p className="text-sm text-ink-400">No asset on the register for {fy}. Add the looms, the compressor, the computers — each with the day it was put to use.</p>}
        <div className={r.rows.length === 0 ? "hidden" : "overflow-x-auto"}>
          <table className="w-full text-sm" aria-label="Fixed asset register">
            <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Asset</th><th className={`${th} text-left`}>Block</th><th className={`${th} text-left`}>Put to use</th><th className={`${th} text-right`}>Cost</th><th className={`${th} text-right`}>Opening WDV</th><th className={`${th} text-right`}>Dep. (Cos. Act)</th><th className={`${th} text-right`}>Closing WDV</th><th className={`${th} text-right`}>Dep. (IT)</th><th className={`${th} text-right`}>IT WDV</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {r.rows.map((a) => (
                <tr key={a._id} className={a.status !== "active" ? "text-ink-400" : ""}>
                  <td className="py-1.5"><span className="font-medium">{a.name}</span><span className="block text-xs text-ink-400">{a.assetNo}{a.identifier ? ` · ${a.identifier}` : ""}{a.supplierName ? ` · ${a.supplierName}` : ""}</span></td>
                  <td className="py-1.5">{a.blockLabel}<span className="block text-xs text-ink-400">{a.method.toUpperCase()}{a.year.companiesAct.rate !== null ? ` ${a.year.companiesAct.rate}%` : ""} · IT {a.year.incomeTax.rate}%{a.year.halfRate ? " (half)" : ""}</span></td>
                  <td className="py-1.5 whitespace-nowrap">{formatDate(a.putToUse)}{a.addedThisYear && <StatusChip tone="info" className="ml-1">new</StatusChip>}</td>
                  <td className={num}>{money(a.cost)}</td><td className={num}>{money(a.year.companiesAct.opening)}</td><td className={`${num} font-medium`}>{money(a.year.companiesAct.depreciation)}</td><td className={num}>{money(a.year.companiesAct.closing)}</td><td className={num}>{money(a.year.incomeTax.depreciation)}</td><td className={num}>{money(a.year.incomeTax.closing)}</td>
                  <td className="py-1.5 text-right">{a.status === "active" ? <Button size="sm" variant="ghost" onClick={() => setDisposing(a)}>Sold / scrapped</Button> : <StatusChip tone="neutral">{a.status}{a.year.disposal ? ` · ${a.year.disposal.gainLoss >= 0 ? "gain" : "loss"} ₹${money(Math.abs(a.year.disposal.gainLoss))}` : ""}</StatusChip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Closing stock ────────────────────────────────────────────────────
function ClosingStockSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [asOf, setAsOf] = useState(today());
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "closing-stock", asOf], queryFn: () => accountsService.closingStock(asOf) });
  const [posting, setPosting] = useState(false);
  const post = async () => {
    setPosting(true);
    try { const r = await accountsService.postClosingStock(asOf); qc.setQueryData([ACCOUNTS_KEY, "closing-stock", asOf], r.valuation); toast(`${r.closing.journalNo} posted: stock ₹${money(r.closing.total)} on ${formatDate(asOf)}, brought forward by ${r.opening.journalNo}`, "success"); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "journals"] }); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not post it", "error"); }
    finally { setPosting(false); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">Closing stock</h3>
            <p className="text-sm text-ink-500">Raw material at weighted average cost, finished goods at costing — what the books carry as stock on the day.</p>
          </div>
          <Input label="As on" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || today())} />
        </div>
        {q.isLoading || !q.data ? <Skeleton className="mt-3 h-32 w-full" /> : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-ink-50 p-3 text-sm"><p className="text-xs text-ink-400">Raw material</p><p className="text-lg font-semibold tabular-nums">₹{money(q.data.rawMaterials.total)}</p><p className="text-xs text-ink-500">{q.data.rawMaterials.rows.length} materials</p></div>
              <div className="rounded-lg bg-ink-50 p-3 text-sm"><p className="text-xs text-ink-400">Finished goods</p><p className="text-lg font-semibold tabular-nums">₹{money(q.data.finishedGoods.total)}</p><p className="text-xs text-ink-500">{q.data.finishedGoods.rows.length} elastics</p></div>
              <div className="rounded-lg bg-brand-50 p-3 text-sm"><p className="text-xs text-ink-400">Closing stock</p><p className="text-lg font-semibold tabular-nums">₹{money(q.data.total)}</p></div>
            </div>
            {q.data.warnings.length > 0 && (
              <div className="mt-3 rounded-lg bg-status-warningBg p-3 text-sm" role="alert">
                <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Valued at nothing — fix the cost, then value again</p>
                <ul className="mt-1 list-disc pl-5">{q.data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {q.data.journals.closing ? <StatusChip tone={q.data.journals.stale ? "warning" : "success"}>{q.data.journals.closing.journalNo} · ₹{money(q.data.journals.closing.total)}{q.data.journals.stale ? " · stale, post again" : ""}</StatusChip> : <StatusChip tone="neutral">Not posted for this day</StatusChip>}
              <Button size="sm" variant="secondary" loading={posting} disabled={!(q.data.total > 0)} onClick={post}>{q.data.journals.closing ? "Post again" : "Post closing stock"}</Button>
              <span className="text-xs text-ink-400">Dr Stock-in-Hand · Cr Closing Stock on the day, and reversed the next, so the period after opens with it</span>
            </div>
            {q.data.history.length > 0 && <p className="mt-2 text-xs text-ink-400">Posted so far: {q.data.history.map((h) => `${formatDate(h.asOf)} ₹${money(h.total)}`).join(" · ")}</p>}
          </>
        )}
      </Card>
      {q.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h4 className="font-semibold">Raw material by category</h4>
            <table className="mt-2 w-full text-sm" aria-label="Raw material by category"><thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Category</th><th className={`${th} text-right`}>Items</th><th className={`${th} text-right`}>Quantity</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody className="divide-y divide-ink-100">{q.data.rawMaterials.byCategory.map((c) => <tr key={c.category}><td className="py-1.5">{c.category}</td><td className={num}>{c.items}</td><td className={num}>{money(c.quantity)}</td><td className={num}>{money(c.value)}</td></tr>)}{q.data.rawMaterials.byCategory.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={4}>Nothing on the shelf on that day.</td></tr>}</tbody></table>
            <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand-600">Every material</summary>
              <table className="mt-2 w-full text-sm"><tbody className="divide-y divide-ink-100">{q.data.rawMaterials.rows.map((m) => <tr key={m.id}><td className="py-1">{m.name}<span className="block text-xs text-ink-400">{m.basis === "average" ? "average cost" : "latest price"}</span></td><td className={num}>{money(m.quantity)} {m.unit}</td><td className={num}>@ {money(m.rate)}</td><td className={num}>{money(m.value)}</td></tr>)}</tbody></table>
            </details>
          </Card>
          <Card className="p-5">
            <h4 className="font-semibold">Finished goods</h4>
            <table className="mt-2 w-full text-sm" aria-label="Finished goods"><thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Elastic</th><th className={`${th} text-right`}>Metres</th><th className={`${th} text-right`}>Cost / m</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody className="divide-y divide-ink-100">{q.data.finishedGoods.rows.map((e) => <tr key={e.id}><td className="py-1.5">{e.name}</td><td className={num}>{money(e.quantity)}</td><td className={`${num} ${e.rate > 0 ? "" : "text-status-warning"}`}>{e.rate > 0 ? money(e.rate) : "no costing"}</td><td className={num}>{money(e.value)}</td></tr>)}{q.data.finishedGoods.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={4}>No finished goods in stock on that day.</td></tr>}</tbody></table>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Budgets ──────────────────────────────────────────────────────────
const STATE_TONE: Record<BudgetRow["state"], "danger" | "warning" | "success" | "neutral"> = { over: "danger", near: "warning", ok: "success", unbudgeted: "neutral" };
function BudgetsSection({ fy }: { fy: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "budgets", fy], queryFn: () => accountsService.budgets(fy) });
  const { data: categories } = useCategories();
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState("");
  const rows = q.data?.rows ?? [];
  const save = async () => {
    const changed = Object.entries(edit).filter(([, v]) => v !== "").map(([category, v]) => ({ category, annual: Number(v) || 0 }));
    if (!changed.length) return;
    setBusy(true);
    try { const r = await accountsService.saveBudgets(fy, changed); qc.setQueryData([ACCOUNTS_KEY, "budgets", fy], r); setEdit({}); setAdding(""); toast(`Budgets saved for ${fy}`, "success"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); }
    finally { setBusy(false); }
  };
  const unlisted = useMemo(() => (categories ?? []).filter((c) => c.active !== false && !rows.some((r) => r.category === c._id)), [categories, rows]);
  if (q.isLoading || !q.data) return <Skeleton className="h-64 w-full" />;
  const r = q.data;
  const shown = [...rows, ...(adding && !rows.some((x) => x.category === adding) ? [{ category: adding, name: (categories ?? []).find((c) => c._id === adding)?.name ?? "", ledger: "", active: true, budget: Array(12).fill(0), actual: Array(12).fill(0), budgetTotal: 0, actualTotal: 0, ytdBudget: 0, ytdActual: 0, variance: 0, used: null, overMonths: [], state: "unbudgeted" as const, projected: 0, note: "", count: 0 }] : [])];
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">Budget against actual · {fy}</h3>
            <p className="text-sm text-ink-500">{r.elapsed} of 12 months run · budget to date ₹{money(r.totals.ytdBudget)} · spent ₹{money(r.totals.ytdActual)}{r.totals.over ? <span className="text-status-danger"> · {r.totals.over} head{r.totals.over === 1 ? "" : "s"} over</span> : null}{r.totals.unbudgeted ? ` · ${r.totals.unbudgeted} spent without a budget` : ""}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {unlisted.length > 0 && <Select label="Add a head" value={adding} onChange={(e) => setAdding(e.target.value)} options={unlisted.map((c) => ({ value: c._id, label: c.name }))} placeholder="Pick a head" />}
            <Button variant="secondary" loading={busy} disabled={!Object.values(edit).some((v) => v !== "")} onClick={save}>Save budgets</Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Budgets">
            <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Head</th><th className={`${th} text-right`}>Year's budget (₹)</th><th className={`${th} text-right`}>Budget to date</th><th className={`${th} text-right`}>Spent to date</th><th className={`${th} text-right`}>Variance</th><th className={`${th} text-right`}>Used</th><th className={`${th} text-right`}>At this pace</th><th className={`${th} text-left pl-3`}>Months over</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((b) => (
                <tr key={b.category}>
                  <td className="py-1.5"><span className="font-medium">{b.name}</span> <StatusChip tone={STATE_TONE[b.state]} className="ml-1">{b.state === "unbudgeted" ? "no budget" : b.state}</StatusChip></td>
                  <td className="py-1.5 text-right"><Input aria-label={`Budget for ${b.name}`} type="number" min={0} step="1000" className="w-32 text-right" value={edit[b.category] ?? (b.budgetTotal || "")} onChange={(e) => setEdit({ ...edit, [b.category]: e.target.value })} /></td>
                  <td className={num}>{money(b.ytdBudget)}</td><td className={`${num} font-medium`}>{money(b.ytdActual)}</td>
                  <td className={`${num} ${b.variance < 0 ? "text-status-danger" : ""}`}>{b.variance < 0 ? "−" : ""}{money(Math.abs(b.variance))}</td>
                  <td className={num}>{b.used === null ? "—" : `${b.used}%`}</td><td className={num}>{money(b.projected)}</td>
                  <td className="py-1.5 pl-3 text-xs text-ink-500">{b.overMonths.join(", ") || "—"}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={8}>No expense heads yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-400">A year's figure is spread evenly over April to March. Actual is what the books hold under the head: approved expenses, and service bills booked to it, net of GST.</p>
      </Card>
    </div>
  );
}

// ── Cost centres ─────────────────────────────────────────────────────
function CostCentresSection() {
  const [range, setRange] = useState(defaultPeriod());
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "cost-centres", range.from, range.to], queryFn: () => accountsService.costCentres(range.from, range.to) });
  const group = (title: string, rows: NonNullable<typeof q.data>["orders"], to?: (g: NonNullable<typeof q.data>["orders"][number]) => string) => (
    <Card className="p-5">
      <h4 className="font-semibold">{title}</h4>
      <table className="mt-2 w-full text-sm" aria-label={title}><thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Centre</th><th className={`${th} text-right`}>Documents</th><th className={`${th} text-right`}>Spend</th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((g) => <tr key={g.key}><td className="py-1.5">{to && to(g) ? <Link className="text-brand-600 hover:underline" to={to(g)}>{g.name}</Link> : g.name}<span className="block text-xs text-ink-400">{g.docs.slice(0, 3).map((d) => d.docNo).join(", ")}{g.docs.length > 3 ? ` +${g.docs.length - 3}` : ""}</span></td><td className={num}>{g.count}</td><td className={`${num} font-medium`}>{money(g.total)}</td></tr>)}
          {rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={3}>Nothing booked here in the period.</td></tr>}
        </tbody></table>
    </Card>
  );
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="font-semibold">Cost centres</h3><p className="text-sm text-ink-500">Bills and expenses booked to an order, a machine or a department, net of GST claimed. The order's P&L carries its own.</p></div>
          <RangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
        {q.data && <p className="mt-2 text-sm">Allocated ₹{money(q.data.allocated)} · <span className={q.data.unallocated > 0 ? "text-status-warning" : ""}>not allocated ₹{money(q.data.unallocated)} ({q.data.unallocatedCount} document{q.data.unallocatedCount === 1 ? "" : "s"})</span></p>}
      </Card>
      {q.isLoading || !q.data ? <Skeleton className="h-48 w-full" /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {group("Orders", q.data.orders, (g) => (g.ref ? `/pnl/orders/${g.ref}` : ""))}
          {group("Machines", q.data.machines, (g) => (g.ref ? `/machines/${g.ref}` : ""))}
          {group("Departments", q.data.departments)}
        </div>
      )}
    </div>
  );
}

// ── Sales and purchase registers ─────────────────────────────────────
function RegisterSection({ kind }: { kind: "sales" | "purchase" }) {
  const [range, setRange] = useState(defaultPeriod());
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "register", kind, range.from, range.to], queryFn: () => accountsService.register(kind, range.from, range.to) });
  const rates = useMemo(() => [...new Set((q.data?.rows ?? []).flatMap((r) => Object.keys(r.byRate)))].sort((a, b) => Number(a) - Number(b)), [q.data]);
  const docPath = (r: NonNullable<typeof q.data>["rows"][number]) => (r.docType === "Invoice" ? `/invoices/${r.id}` : r.docType === "AccountNote" ? `/accounts/notes/${r.id}` : r.docType === "SupplierBill" ? `/accounts/bills/${r.id}` : `/accounts/expenses/${r.id}`);
  const signed = (n: number, r: { sign: 1 | -1; cancelled: boolean }) => (r.cancelled ? <span className="line-through">{money(n)}</span> : r.sign < 0 ? `−${money(n)}` : money(n));
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold">{kind === "sales" ? "Sales register" : "Purchase register"}</h3>
            {q.data && <p className="text-sm text-ink-500">{q.data.totals.count - q.data.totals.cancelled} document{q.data.totals.count - q.data.totals.cancelled === 1 ? "" : "s"}{q.data.totals.cancelled ? `, ${q.data.totals.cancelled} cancelled` : ""} · taxable ₹{money(q.data.totals.taxable)} · tax ₹{money(q.data.totals.tax)} · total ₹{money(q.data.totals.grand)}{kind === "purchase" && q.data.totals.itc !== undefined ? ` · credit claimed ₹${money(q.data.totals.itc)}` : ""}</p>}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <RangePicker from={range.from} to={range.to} onChange={setRange} />
            <a href={accountsService.registerXlsxUrl(kind, range.from, range.to)} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><Download className="h-4 w-4" /> Excel</a>
          </div>
        </div>
      </Card>
      <Card className="p-5">
        {q.isLoading || !q.data ? <Skeleton className="h-48 w-full" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={kind === "sales" ? "Sales register" : "Purchase register"}>
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Date</th><th className={`${th} text-left`}>Document</th><th className={`${th} text-left`}>{kind === "sales" ? "Customer" : "Supplier / payee"}</th><th className={`${th} text-left`}>GSTIN · state</th>{rates.map((x) => <th key={x} className={`${th} text-right`}>@ {x}%</th>)}<th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-left pl-3`}>{kind === "sales" ? "IRN · e-way bill" : "Credit · 2B · TDS"}</th><th className={`${th} text-right`}>Open</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {q.data.rows.map((r) => (
                  <tr key={`${r.docType}-${r.id}`} className={r.cancelled ? "text-ink-400" : ""}>
                    <td className="py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="py-1.5"><Link to={docPath(r)} className="font-medium text-brand-600 hover:underline">{r.docNo}</Link><span className="block text-xs text-ink-400">{r.kind}{r.refNo ? ` · ${r.refNo}` : ""}{r.against ? ` · vs ${r.against}` : ""}{r.exportKind ? ` · ${r.exportKind}` : ""}{r.financial ? " · financial" : ""}{r.interest ? " · interest" : ""}{r.cancelled ? " · CANCELLED" : ""}</span></td>
                    <td className="py-1.5">{r.partyName}{r.head ? <span className="block text-xs text-ink-400">{r.head}</span> : null}{r.costCentre ? <span className="block text-xs text-ink-400">{r.costCentre}</span> : null}</td>
                    <td className="py-1.5 text-xs text-ink-500">{r.gstin || "unregistered"}<span className="block">{r.state}</span></td>
                    {rates.map((x) => <td key={x} className={num}>{r.byRate[x] ? signed(r.byRate[x], r) : ""}</td>)}
                    <td className={num}>{signed(r.taxable, r)}</td><td className={num}>{signed(r.cgst, r)}</td><td className={num}>{signed(r.sgst, r)}</td><td className={num}>{signed(r.igst, r)}</td><td className={`${num} font-medium`}>{signed(r.grand, r)}</td>
                    <td className="py-1.5 pl-3 text-xs text-ink-500">{kind === "sales" ? [r.irn ? `IRN ${r.irn.slice(0, 8)}…` : "", r.ewaybill ? `EWB ${r.ewaybill}` : ""].filter(Boolean).join(" · ") || "—" : [r.itc ? "ITC" : "no ITC", r.reverseCharge ? `RCM ₹${money(r.rcmTax)}` : "", r.gstr2b || "", r.tds || ""].filter(Boolean).join(" · ")}</td>
                    <td className={num}>{r.outstanding ? money(r.outstanding) : ""}</td>
                  </tr>
                ))}
                {q.data.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={12 + rates.length}>Nothing in the period.</td></tr>}
              </tbody>
              {q.data.rows.length > 0 && <tfoot><tr className="border-t border-ink-200 font-semibold"><td className="py-2" colSpan={4}>Total</td>{rates.map((x) => <td key={x} className={num}>{money(q.data!.totals.byRate[x] || 0)}</td>)}<td className={num}>{money(q.data.totals.taxable)}</td><td className={num}>{money(q.data.totals.cgst)}</td><td className={num}>{money(q.data.totals.sgst)}</td><td className={num}>{money(q.data.totals.igst)}</td><td className={num}>{money(q.data.totals.grand)}</td><td /><td /></tr></tfoot>}
            </table>
          </div>
        )}
        {q.data && q.data.rows.length > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-ink-400"><CheckCircle2 className="h-3.5 w-3.5" /> Credit notes are netted off the totals; cancelled rows are listed and left out.</p>}
      </Card>
    </div>
  );
}
