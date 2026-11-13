import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileJson, Upload, RefreshCw, AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import { round2 } from "@/features/invoices/gst";
import { NoticesSection } from "./NoticesSection";
import { ChallanReader, Form16aReader } from "./TdsPaperReaders";
import type { Gstr2bRow, MsmeDue, TdsChallanResult, TdsRegister } from "./types";

type Section = "notices" | "msme" | "gstr1" | "gstr2b" | "rule37" | "tds" | "payroll";
const SECTIONS: Section[] = ["notices", "msme", "gstr1", "gstr2b", "rule37", "tds", "payroll"];

const lastMonth = () => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() - 1, 1); return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`; };
const thisFy = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(2)}`; };
const monthLabel = (m: string) => { const [y, mm] = m.split("-").map(Number); return new Date(y, mm - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };

const th = "py-2 text-xs font-medium uppercase tracking-wide text-ink-400";
const num = "py-2 text-right tabular-nums";

/**
 * What the law asks of the books each month and year: micro and small
 * suppliers paid within 45 days (s.43B(h)), GSTR-1 prepared from the
 * invoices, input credit checked against GSTR-2B, and credit on bills
 * unpaid 180 days reversed (Rule 37).
 */
export function StatutoryTab() {
  // Other screens link straight to a section: ?section=payroll&month=2026-10
  const [params] = useSearchParams();
  const asked = params.get("section") as Section | null;
  const [section, setSection] = useState<Section>(asked && SECTIONS.includes(asked) ? asked : "msme");
  const [month, setMonth] = useState(/^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : lastMonth());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips options={[{ value: "notices", label: "Notices" }, { value: "msme", label: "MSME 45 days" }, { value: "gstr1", label: "GSTR-1" }, { value: "gstr2b", label: "GSTR-2B" }, { value: "rule37", label: "ITC unpaid 180 days" }, { value: "tds", label: "TDS" }, { value: "payroll", label: "Payroll" }]} value={section} onChange={setSection} />
        {section !== "msme" && section !== "notices" && <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value || lastMonth())} />}
      </div>
      {section === "notices" && <NoticesSection />}
      {section === "msme" && <MsmeSection />}
      {section === "gstr1" && <Gstr1Section month={month} />}
      {section === "gstr2b" && <Gstr2bSection month={month} />}
      {section === "rule37" && <Rule37Section month={month} />}
      {section === "tds" && <TdsSection month={month} />}
      {section === "payroll" && <PayrollSection month={month} />}
    </div>
  );
}

const fyOfMonth = (m: string) => { const [y, mm] = m.split("-").map(Number); const fy = mm >= 4 ? y : y - 1; return `${fy}-${String(fy + 1).slice(2)}`; };
const quarterOfMonth = (m: string) => { const mm = Number(m.split("-")[1]); return mm >= 4 && mm <= 6 ? "Q1" : mm >= 7 && mm <= 9 ? "Q2" : mm >= 10 ? "Q3" : "Q4"; };

function ChallanForm({ month, sections, onDone }: { month: string; sections: string[]; onDone: (r: TdsRegister) => void }) {
  const { toast } = useToast();
  const [section, setSection] = useState(sections[0] ?? "194C");
  // The month the challan pays: this page's month, unless the challan read says another.
  const [forMonth, setForMonth] = useState(month);
  const [amount, setAmount] = useState<number | "">("");
  const [interest, setInterest] = useState<number | "">("");
  const [bsrCode, setBsrCode] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [depositedOn, setDepositedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<TdsChallanResult | null>(null);
  useEffect(() => { setForMonth(month); }, [month]);
  const applyRead = (r: TdsChallanResult) => {
    const d = r.draft;
    if (!d) return;
    setRead(r);
    if (d.section) setSection(d.section);
    if (d.month) setForMonth(d.month);
    setAmount(d.amount); setInterest(d.interest || ""); setBsrCode(d.bsrCode); setChallanNo(d.challanNo); setDepositedOn(d.depositedOn);
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await accountsService.addTdsChallan({ month: forMonth, section, amount: Number(amount), interest: Number(interest) || 0, bsrCode, challanNo, depositedOn, tdsSuggestion: read?.aiSuggestion ?? undefined });
      toast(forMonth === month ? "Challan recorded" : `Challan recorded against ${monthLabel(forMonth)}`, "success");
      setAmount(""); setInterest(""); setBsrCode(""); setChallanNo(""); setRead(null); setForMonth(month);
      onDone(r.register);
    }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not record it", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <ChallanReader onUse={applyRead} />
      {read?.draft?.monthWhy ? <span className="text-xs text-ink-500" aria-label="Month the challan pays">{read.draft.monthWhy}</span> : <span className="text-xs text-ink-400">A photo or PDF of the challan fills this in.</span>}
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <Input label="For month" type="month" value={forMonth} onChange={(e) => setForMonth(e.target.value || month)} className="w-40" />
      <Input label="Section" value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} className="w-24" list="tds-sections" />
      <datalist id="tds-sections">{[...new Set([...sections, "194C", "194I", "194J", "194Q", "194H"])].map((s) => <option key={s} value={s} />)}</datalist>
      <Input label="Amount" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} className="w-32" />
      <Input label="Interest" type="number" step="0.01" min={0} value={interest} onChange={(e) => setInterest(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
      <Input label="BSR code" value={bsrCode} onChange={(e) => setBsrCode(e.target.value)} className="w-28" />
      <Input label="Challan serial" value={challanNo} onChange={(e) => setChallanNo(e.target.value)} className="w-28" />
      <Input label="Deposited on" type="date" value={depositedOn} onChange={(e) => setDepositedOn(e.target.value)} />
      <Button size="sm" disabled={!(Number(amount) > 0) || !depositedOn || !section || !forMonth} loading={busy} onClick={save}>Record challan</Button>
    </div>
    </div>
  );
}

/**
 * TDS on bills booked and not yet paid. The books deduct at payment; the
 * law asks at the bill or the payment, whichever is first. Until the firm
 * decides to book it at the bill, this is the list to act on.
 */
function NotDeducted({ month, d }: { month: string; d: NonNullable<TdsRegister["notDeducted"]> }) {
  const [all, setAll] = useState(false);
  const rows = all ? d.rows : d.rows.slice(0, 8);
  return (
    <Card className="p-5" aria-label="TDS not yet deducted">
      <h3 className="font-semibold">Booked and not yet paid · ₹{money(d.total)} of TDS not deducted</h3>
      <p className="text-sm text-ink-500">
        These books deduct TDS when a bill is paid. The law asks for it when the bill is booked or paid, whichever comes first.
        {" "}{d.rows.length} bill{d.rows.length === 1 ? "" : "s"} of this year {d.rows.length === 1 ? "was" : "were"} still unpaid at the end of {monthLabel(month)}: the tax on {d.rows.length === 1 ? "it" : "them"} fell due in the month each was booked, and is not on the register above.
        Pay them, or ask your accountant whether TDS should be booked at the bill.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full max-w-4xl text-sm" aria-label="Bills with TDS not deducted">
          <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>Bill</th><th className={`${th} text-left`}>Booked</th><th className={`${th} text-left`}>Section</th><th className={`${th} text-right`}>Unpaid</th><th className={`${th} text-right`}>Taxable share</th><th className={`${th} text-right`}>TDS</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="py-1.5">{r.supplierName}</td>
                <td className="py-1.5"><Link to={`/accounts/bills/${r._id}`} className="text-brand-600 hover:underline">{r.billNo}</Link>{r.supplierBillNo && <span className="block text-xs text-ink-400">{r.supplierBillNo}</span>}</td>
                <td className="py-1.5 whitespace-nowrap">{formatDate(r.billDate)}<span className="block text-xs text-ink-400">due for {monthLabel(r.month)}</span></td>
                <td className="py-1.5">{r.section || "—"} · {r.rate}%</td>
                <td className={num}>{money(r.unpaid)}</td>
                <td className={num}>{money(r.base)}</td>
                <td className={`${num} font-medium text-status-danger`}>{money(r.tds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.rows.length > 8 && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAll((x) => !x)}>{all ? "Show fewer" : `Show all ${d.rows.length}`}</Button>}
    </Card>
  );
}

function TdsSection({ month }: { month: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fy = fyOfMonth(month);
  const q = quarterOfMonth(month);
  const [view, setView] = useState<"register" | "26q" | "receivable" | "194q">("register");
  const reg = useQuery({ queryKey: [ACCOUNTS_KEY, "tds-register", month], queryFn: () => accountsService.tdsRegister(month), enabled: view === "register" });
  const f26 = useQuery({ queryKey: [ACCOUNTS_KEY, "tds-26q", fy, q], queryFn: () => accountsService.form26q(fy, q), enabled: view === "26q" });
  const rec = useQuery({ queryKey: [ACCOUNTS_KEY, "tds-receivable", fy], queryFn: () => accountsService.tdsReceivable(fy), enabled: view === "receivable" });
  const p194 = useQuery({ queryKey: [ACCOUNTS_KEY, "tds-194q", fy], queryFn: () => accountsService.purchases194q(fy), enabled: view === "194q" });
  const asRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload26as = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      // The PDF (or a photo) from the portal is read; the CSV or Excel export is parsed as before.
      if (/pdf|image/.test(file.type) || /\.pdf$/i.test(file.name)) {
        const r = await accountsService.read26asPdf([file], fy);
        if (!r.stored) { toast(r.read.problem === "not_26as" ? "That does not look like Form 26AS." : "The Form 26AS could not be read. Try the CSV from the portal.", "error"); return; }
        if (r.receivable) qc.setQueryData([ACCOUNTS_KEY, "tds-receivable", r.stored.fy], r.receivable);
        const s = r.stored;
        toast(`${s.lines} lines read from the PDF${s.fy !== fy ? ` for ${s.fy}` : ""}, ${s.matched} matched to customers${s.unmatched.length ? `; ${s.unmatched.length} not matched` : ""}`, s.unmatched.length || s.fy !== fy ? "info" : "success");
        return;
      }
      const r = await accountsService.upload26as(file, fy); qc.setQueryData([ACCOUNTS_KEY, "tds-receivable", fy], r.receivable); toast(`${r.lines} lines read, ${r.matched} matched to customers${r.unmatched.length ? `; ${r.unmatched.length} not matched` : ""}`, r.unmatched.length ? "info" : "success");
    }
    catch (e) { toast(e instanceof Error ? e.message : "Could not read the file", "error"); }
    finally { setBusy(false); if (asRef.current) asRef.current.value = ""; }
  };
  return (
    <div className="space-y-4">
      <FilterChips options={[{ value: "register", label: "Deposit register" }, { value: "26q", label: `26Q · ${fy} ${q}` }, { value: "receivable", label: "Deducted by customers" }, { value: "194q", label: "194Q purchases" }]} value={view} onChange={setView} />
      {view === "register" && (reg.isLoading || !reg.data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="p-5">
          <h3 className="font-semibold">TDS deducted in {monthLabel(month)} · deposit by {formatDate(reg.data.due)}</h3>
          <p className="text-sm text-ink-500">Deducted ₹{money(reg.data.totals.deducted)} · deposited ₹{money(reg.data.totals.deposited)}{reg.data.totals.balance > 0 && <span className="text-status-danger"> · ₹{money(reg.data.totals.balance)} still to deposit{reg.data.totals.interestDue > 0 ? `, interest running ₹${money(reg.data.totals.interestDue)} (1.5% a month)` : ""}</span>}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full max-w-3xl text-sm" aria-label="TDS register">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Section</th><th className={`${th} text-right`}>Vouchers</th><th className={`${th} text-right`}>Deducted</th><th className={`${th} text-right`}>Deposited</th><th className={`${th} text-right`}>Balance</th><th className={`${th} text-right`}>Interest due</th><th className={`${th} text-left pl-3`}>Challans</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {reg.data.rows.map((r) => <tr key={r.section}><td className="py-1.5 font-medium">{r.section}</td><td className={num}>{r.count}</td><td className={num}>{money(r.deducted)}</td><td className={num}>{money(r.deposited)}</td><td className={`${num} ${r.balance > 0 ? "text-status-danger font-medium" : ""}`}>{money(r.balance)}</td><td className={num}>{r.interestDue ? money(r.interestDue) : ""}</td><td className="py-1.5 pl-3 text-xs text-ink-500">{r.challans.map((c) => `${c.bsrCode}/${c.challanNo} ${formatDate(c.depositedOn)} ₹${money(c.amount)}`).join("; ") || "—"}</td></tr>)}
                {reg.data.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={7}>No TDS deducted in {monthLabel(month)}.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4"><ChallanForm month={month} sections={reg.data.rows.map((r) => r.section)} onDone={(r) => qc.setQueryData([ACCOUNTS_KEY, "tds-register", r.month], r)} /></div>
        </Card>
      ))}
      {view === "register" && reg.data?.notDeducted && reg.data.notDeducted.rows.length > 0 && <NotDeducted month={month} d={reg.data.notDeducted} />}
      {view === "26q" && (f26.isLoading || !f26.data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold">Form 26Q · {f26.data.fy} {f26.data.quarter}</h3><p className="text-sm text-ink-500">{f26.data.totals.deductees} deductee{f26.data.totals.deductees === 1 ? "" : "s"} · ₹{money(f26.data.totals.tds)} deducted on ₹{money(f26.data.totals.amountPaid)} · {f26.data.certificates.length} Form 16A issued</p></div>
            <a href={accountsService.form26qXlsxUrl(f26.data.fy, f26.data.quarter)} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><Download className="h-4 w-4" /> Excel for the return</a>
          </div>
          {f26.data.checks.length > 0 && <div className="mt-3 rounded-lg bg-status-warningBg p-3 text-sm" aria-label="26Q checks"><ul className="space-y-0.5">{f26.data.checks.map((c, i) => <li key={i}><StatusChip tone={c.level === "error" ? "danger" : "warning"}>{c.doc}</StatusChip> <span className="ml-1">{c.text}</span></li>)}</ul></div>}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm" aria-label="26Q rows">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Deductee</th><th className={`${th} text-left`}>PAN</th><th className={`${th} text-left`}>Section</th><th className={`${th} text-left`}>Paid on</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>TDS</th><th className={`${th} text-left pl-3`}>Challan</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {f26.data.rows.map((r) => <tr key={`${r.voucherNo}:${r.section}`}><td className="py-1.5">{r.deductee}<span className="block text-xs text-ink-400">{r.voucherNo} · {r.docs.join(", ")}</span></td><td className={`py-1.5 font-mono text-xs ${r.pan ? "" : "text-status-danger"}`}>{r.pan || "missing"}</td><td className="py-1.5">{r.section} @ {r.rate}%</td><td className="py-1.5 whitespace-nowrap">{formatDate(r.date)}</td><td className={num}>{money(r.amountPaid)}</td><td className={num}>{money(r.tds)}</td><td className="py-1.5 pl-3 text-xs">{r.challan || <span className="text-status-warning">not deposited</span>}</td></tr>)}
                {f26.data.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={7}>No TDS deducted this quarter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      {view === "receivable" && (rec.isLoading || !rec.data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold">TDS customers deducted from us · {rec.data.fy}</h3><p className="text-sm text-ink-500">₹{money(rec.data.totals.deducted)} kept back on receipts · certificates received ₹{money(rec.data.totals.certificates)} · in Form 26AS ₹{money(rec.data.totals.in26as)}{rec.data.unmatched26as > 0 ? ` (₹${money(rec.data.unmatched26as)} in 26AS from deductors not on file)` : ""}</p></div>
            <div className="flex flex-wrap gap-2">
              <Form16aReader onSaved={(saved) => qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY, "tds-receivable", saved] })} />
              <input ref={asRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/pdf,.pdf" className="hidden" aria-label="Form 26AS file" onChange={(e) => upload26as(e.target.files?.[0])} />
              <Button variant="secondary" loading={busy} onClick={() => asRef.current?.click()} title="The CSV or Excel export, or the PDF, from the income-tax portal"><Upload className="h-4 w-4" /> Upload Form 26AS</Button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full max-w-4xl text-sm" aria-label="TDS receivable">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Customer</th><th className={`${th} text-right`}>Deducted (books)</th><th className={`${th} text-right`}>Certificates</th><th className={`${th} text-right`}>In 26AS</th><th className={`${th} text-left pl-3`}>Position</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {rec.data.rows.map((r) => <tr key={r.customer}><td className="py-1.5">{r.customerName}</td><td className={num}>{money(r.deducted)}</td><td className={num}>{money(r.certificates)}</td><td className={num}>{money(r.in26as)}</td><td className="py-1.5 pl-3"><StatusChip tone={r.state === "matched" ? "success" : r.state === "no26as" ? "neutral" : r.state === "short" ? "danger" : "warning"}>{r.state === "matched" ? "matches 26AS" : r.state === "no26as" ? "no 26AS yet" : r.state === "short" ? `₹${money(r.short26as)} short in 26AS` : "more in 26AS"}</StatusChip></td></tr>)}
                {rec.data.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={5}>No customer kept TDS back this year.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-400">Short in 26AS: the customer deducted but did not deposit or file it against our PAN; the credit is lost until they do. Chase them for the certificate and the correction.</p>
        </Card>
      ))}
      {view === "194q" && (p194.isLoading || !p194.data ? <Skeleton className="h-48 w-full" /> : (
        <Card className="p-5">
          <h3 className="font-semibold">s.194Q · goods bought from each supplier in {p194.data.fy}</h3>
          <p className="text-sm text-ink-500">{p194.data.settings.enabled ? `On: ${p194.data.settings.rate}% on purchases beyond ₹${money(p194.data.settings.limit)} from one seller. ${p194.data.totals.crossed} supplier${p194.data.totals.crossed === 1 ? "" : "s"} past the limit; ₹${money(p194.data.totals.tdsDeducted)} deducted of ₹${money(p194.data.totals.tdsDue)} due.` : "Off. Turn it on under Settings → Books once last year's turnover crossed ₹10 crore."}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full max-w-4xl text-sm" aria-label="194Q purchases">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>PAN</th><th className={`${th} text-right`}>Purchases (taxable)</th><th className={`${th} text-right`}>Over the limit</th><th className={`${th} text-right`}>TDS due</th><th className={`${th} text-right`}>Deducted</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {p194.data.rows.map((r) => <tr key={r.supplier} className={r.crossed ? "" : "text-ink-500"}><td className="py-1.5">{r.supplierName}</td><td className="py-1.5 font-mono text-xs">{r.pan || "—"}</td><td className={num}>{money(r.purchases)}</td><td className={num}>{r.over ? money(r.over) : ""}</td><td className={num}>{r.tdsDue ? money(r.tdsDue) : ""}</td><td className={num}>{r.tdsDeducted ? money(r.tdsDeducted) : ""}</td></tr>)}
                {p194.data.rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={6}>No goods bought this year.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PayrollSection({ month }: { month: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "payroll-books", month], queryFn: () => accountsService.payrollBooks(month) });
  const [busy, setBusy] = useState<string | null>(null);
  const [dep, setDep] = useState<{ kind: "pf" | "esi" | "pt"; amount: number | ""; challanNo: string; depositedOn: string }>({ kind: "pf", amount: "", challanNo: "", depositedOn: "" });
  const run = async (key: string, fn: () => Promise<{ summary: unknown }>, done: string) => {
    setBusy(key);
    try { const r = await fn(); qc.setQueryData([ACCOUNTS_KEY, "payroll-books", month], r.summary); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }); toast(done, "success"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not post", "error"); }
    finally { setBusy(null); }
  };
  if (q.isLoading || !q.data) return <Skeleton className="h-64 w-full" />;
  const d = q.data;
  const t = d.totals;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold">Payroll for {monthLabel(month)} in the books</h3>
        <p className="text-sm text-ink-500">{t.people} slip{t.people === 1 ? "" : "s"} finalised{d.drafts ? `, ${d.drafts} still draft` : ""}. The salary journal charges the month's wages and sets up what is owed; the paid journal clears it as cash goes out.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full max-w-xl text-sm" aria-label="Payroll month">
            <tbody className="divide-y divide-ink-100">
              <tr><td className="py-1">Gross earnings</td><td className={num}>{money(t.gross)}</td></tr>
              <tr><td className="py-1">Bonuses</td><td className={num}>{money(t.bonuses)}</td></tr>
              <tr><td className="py-1">Penalties and other deductions</td><td className={num}>− {money(t.other)}</td></tr>
              <tr className="font-semibold"><td className="py-1">Salaries &amp; Wages (expense)</td><td className={num}>{money(t.expense)}</td></tr>
              <tr><td className="py-1 pl-4 text-ink-500">PF payable (employees' share)</td><td className={num}>{money(t.pf)}</td></tr>
              <tr><td className="py-1 pl-4 text-ink-500">ESI payable</td><td className={num}>{money(t.esi)}</td></tr>
              <tr><td className="py-1 pl-4 text-ink-500">Advances recovered</td><td className={num}>{money(t.advances)}</td></tr>
              <tr className="font-semibold"><td className="py-1 pl-4">Salary payable (net)</td><td className={num}>{money(t.net)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={d.journals.salary && !d.journals.salaryStale ? "secondary" : "primary"} disabled={!t.people} loading={busy === "salary"} onClick={() => run("salary", () => accountsService.postPayrollSalary(month), "Salary journal posted")}><Send className="h-4 w-4" /> {d.journals.salary ? (d.journals.salaryStale ? "Re-post salary journal (slips changed)" : "Re-post salary journal") : "Post salary journal"}</Button>
          {d.journals.salary && <span className="text-sm text-ink-500">{d.journals.salary.journalNo} · ₹{money(d.journals.salary.total)}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={d.journals.paid && !d.journals.paidStale ? "secondary" : "primary"} disabled={!(d.paid > 0)} loading={busy === "paid"} onClick={() => run("paid", () => accountsService.postPayrollPaid(month), "Paid journal posted")}><Send className="h-4 w-4" /> {d.journals.paid ? "Re-post paid journal" : `Post cash paid out (₹${money(d.paid)})`}</Button>
          {d.journals.paid && <span className="text-sm text-ink-500">{d.journals.paid.journalNo} · ₹{money(d.journals.paid.total)}</span>}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold">PF and ESI · due by {formatDate(d.statutory.due)}</h3>
        <p className="text-sm text-ink-500">The employees' share deposited after the due day is not an expense of the year (s.36(1)(va)).</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["pf", "esi"] as const).map((k) => { const x = d.statutory[k]; const left = Math.max(0, x.due - x.deposited); return (
            <div key={k} className={`rounded-lg px-3 py-2 ${x.late ? "bg-status-dangerBg" : left > 0.005 ? "bg-status-warningBg" : "bg-status-successBg"}`}>
              <span className="text-xs uppercase text-ink-500">{k}</span>
              <span className="block font-semibold tabular-nums">₹{money(x.deposited)} of ₹{money(x.due)}</span>
              <span className="block text-xs text-ink-500">{x.late ? "deposited late: disallowed" : left > 0.005 ? `₹${money(left)} to deposit` : "deposited in time"}</span>
            </div>
          ); })}
          <div className="rounded-lg bg-canvas px-3 py-2"><span className="text-xs uppercase text-ink-500">Professional tax</span><span className="block font-semibold tabular-nums">₹{money(d.statutory.pt.deposited)}</span></div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Select label="Deposit" value={dep.kind} onChange={(e) => setDep({ ...dep, kind: e.target.value as "pf" | "esi" | "pt" })} options={[{ value: "pf", label: "PF" }, { value: "esi", label: "ESI" }, { value: "pt", label: "Professional tax" }]} />
          <Input label="Amount" type="number" step="0.01" min={0} value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value === "" ? "" : Number(e.target.value) })} className="w-32" />
          <Input label="Challan / TRRN" value={dep.challanNo} onChange={(e) => setDep({ ...dep, challanNo: e.target.value })} className="w-40" />
          <Input label="Deposited on" type="date" value={dep.depositedOn} onChange={(e) => setDep({ ...dep, depositedOn: e.target.value })} />
          <Button size="sm" disabled={!(Number(dep.amount) > 0) || !dep.depositedOn} loading={busy === "dep"} onClick={() => run("dep", () => accountsService.addStatutoryDeposit({ kind: dep.kind, month, amount: Number(dep.amount), challanNo: dep.challanNo, depositedOn: dep.depositedOn }), "Deposit recorded").then(() => setDep({ ...dep, amount: "", challanNo: "" }))}>Record deposit</Button>
        </div>
      </Card>
    </div>
  );
}

const DUE_TONE: Record<MsmeDue["state"], "success" | "warning" | "danger"> = { ok: "success", dueSoon: "warning", overdue: "danger" };

function MsmeSection() {
  const [fy, setFy] = useState(thisFy());
  const dues = useQuery({ queryKey: [ACCOUNTS_KEY, "msme"], queryFn: accountsService.msme });
  const ye = useQuery({ queryKey: [ACCOUNTS_KEY, "msme-year-end", fy], queryFn: () => accountsService.msmeYearEnd(fy) });
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">Bills to micro and small suppliers</h3>
            <p className="text-sm text-ink-500">To be paid within 15 days of the bill, or the days agreed in writing (at most 45). Unpaid past that at 31 March, the expense is disallowed for the year (s.43B(h)); interest is owed to the supplier from the due day (MSMED Act s.16).</p>
          </div>
          <a href={accountsService.msmeForm1Url()} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><Download className="h-4 w-4" /> MSME Form I</a>
        </div>
        {dues.isLoading ? <Skeleton className="mt-3 h-32" /> : dues.data && (
          dues.data.suppliers === 0 ? <p className="mt-3 text-sm text-ink-500">No supplier is marked as a micro or small enterprise yet. Set it on the supplier (Udyam number and category) under Masters → Suppliers.</p>
          : dues.data.rows.length === 0 ? <p className="mt-3 text-sm text-ink-500">Nothing is owed to the {dues.data.suppliers} MSME supplier{dues.data.suppliers === 1 ? "" : "s"} on file.</p> : (
            <>
              <p className="mt-2 text-sm">{dues.data.totals.count} open bill{dues.data.totals.count === 1 ? "" : "s"} · ₹{money(dues.data.totals.outstanding)}{dues.data.totals.overdueCount > 0 && <span className="text-status-danger"> · {dues.data.totals.overdueCount} past the limit, ₹{money(dues.data.totals.overdue)}</span>}</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm" aria-label="MSME dues">
                  <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>Bill</th><th className={`${th} text-left`}>Bill date</th><th className={`${th} text-left`}>Pay by</th><th className={`${th} text-right`}>Outstanding</th><th className={`${th} text-left pl-3`}>Days</th></tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {dues.data.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2">{r.partyName}<span className="block text-xs text-ink-400">{r.category}{r.udyam ? ` · ${r.udyam}` : ""}</span></td>
                        <td className="py-2"><Link to={r.docType === "SupplierBill" ? `/accounts/bills/${r.id}` : `/accounts/expenses/${r.id}`} className="text-brand-600 hover:underline">{r.docNo}</Link>{r.refNo && <span className="block text-xs text-ink-400">{r.refNo}</span>}</td>
                        <td className="py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="py-2 whitespace-nowrap">{formatDate(r.dueDate)}<span className="block text-xs text-ink-400">{r.days} days</span></td>
                        <td className={`${num} font-medium`}>{money(r.outstanding)}</td>
                        <td className="py-2 pl-3"><StatusChip tone={DUE_TONE[r.state]}>{r.daysLeft < 0 ? `${-r.daysLeft}d late` : r.daysLeft === 0 ? "today" : `${r.daysLeft}d left`}</StatusChip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-semibold">Year end: s.43B(h)</h3>
            <p className="text-sm text-ink-500">Each MSME bill of the year: paid in time, paid late (allowed, interest owed), or unpaid at 31 March past its day (disallowed this year, allowed when paid).</p>
          </div>
          <Input label="Financial year" value={fy} onChange={(e) => setFy(e.target.value)} placeholder="2026-27" />
        </div>
        {ye.isLoading ? <Skeleton className="mt-3 h-24" /> : ye.data && (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-status-successBg px-3 py-2"><span className="text-xs text-ink-500">Paid in time</span><span className="block font-semibold tabular-nums">₹{money(ye.data.totals.allowed)}</span></div>
              <div className="rounded-lg bg-status-warningBg px-3 py-2"><span className="text-xs text-ink-500">Paid late (interest owed)</span><span className="block font-semibold tabular-nums">₹{money(ye.data.totals.late)}</span></div>
              <div className="rounded-lg bg-status-dangerBg px-3 py-2"><span className="text-xs text-ink-500">Disallowed at year end</span><span className="block font-semibold tabular-nums">₹{money(ye.data.totals.disallowed)}</span></div>
            </div>
            {ye.data.rows.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm" aria-label="MSME year end">
                  <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>Bill</th><th className={`${th} text-left`}>Pay by</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-left pl-3`}>Last paid</th><th className={`${th} text-left`}>Position</th></tr></thead>
                  <tbody className="divide-y divide-ink-100">
                    {ye.data.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2">{r.partyName}</td>
                        <td className="py-2"><Link to={`/accounts/bills/${r.id}`} className="text-brand-600 hover:underline">{r.docNo}</Link></td>
                        <td className="py-2 whitespace-nowrap">{formatDate(r.dueDate)}</td>
                        <td className={num}>{money(r.amount)}</td>
                        <td className="py-2 pl-3 whitespace-nowrap">{r.lastPaid ? formatDate(r.lastPaid) : "—"}</td>
                        <td className="py-2"><StatusChip tone={r.status === "allowed" ? "success" : r.status === "late" ? "warning" : "danger"}>{r.status === "allowed" ? "in time" : r.status === "late" ? `late · ₹${money(r.paidLate)}` : `disallowed · ₹${money(r.disallowed)}`}</StatusChip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Gstr1Section({ month }: { month: string }) {
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "gstr1", month], queryFn: () => accountsService.gstr1(month) });
  const [table, setTable] = useState<"b2b" | "b2cs" | "exp" | "cdn" | "hsn" | "docs">("b2b");
  if (q.isLoading || !q.data) return <Skeleton className="h-64 w-full" />;
  const r = q.data;
  const errors = r.checks.filter((c) => c.level === "error");
  const sum = (k: keyof typeof r.summary) => r.summary[k];
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">GSTR-1 · {monthLabel(month)}</h3>
            <p className="text-sm text-ink-500">{r.counts.invoices} invoice{r.counts.invoices === 1 ? "" : "s"}, {r.counts.notes} note{r.counts.notes === 1 ? "" : "s"}{r.counts.cancelled ? `, ${r.counts.cancelled} cancelled` : ""} · HSN at {r.hsnDigits} digits{r.gstin ? ` · ${r.gstin}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={accountsService.gstr1JsonUrl(month)} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><FileJson className="h-4 w-4" /> JSON for the offline tool</a>
            <a href={accountsService.gstr1XlsxUrl(month)} className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"><Download className="h-4 w-4" /> Excel</a>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full max-w-2xl text-sm" aria-label="GSTR-1 summary">
            <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Table</th><th className={`${th} text-right`}>Documents</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>Tax</th><th className={`${th} text-right`}>Value</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {([["b2b", "4 · B2B (registered, SEZ, deemed export)"], ["b2cl", "5 · B2C large (inter-state, over ₹1 lakh)"], ["exp", "6A · Exports"], ["b2cs", "7 · B2C small"], ["cdnr", "9B · Notes to registered"], ["cdnur", "9B · Notes to unregistered"]] as const).map(([k, label]) => (
                <tr key={k}><td className="py-1.5">{label}</td><td className={num}>{sum(k).count}</td><td className={num}>{money(sum(k).txval)}</td><td className={num}>{money(sum(k).tax)}</td><td className={num}>{money(sum(k).val)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.checks.length > 0 ? (
          <div className="mt-3 rounded-lg bg-status-warningBg p-3 text-sm" aria-label="GSTR-1 checks">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> {errors.length ? `${errors.length} to fix before filing` : "Worth a look before filing"}</p>
            <ul className="mt-1 space-y-0.5">{r.checks.map((c, i) => <li key={i}><StatusChip tone={c.level === "error" ? "danger" : "warning"}>{c.doc}</StatusChip> <span className="ml-1">{c.text}</span></li>)}</ul>
          </div>
        ) : <p className="mt-3 flex items-center gap-2 text-sm text-status-success"><CheckCircle2 className="h-4 w-4" /> Every invoice has a GSTIN where one is on file, an HSN of {r.hsnDigits} digits, and every note its invoice.</p>}
      </Card>
      <Card className="p-5">
        <FilterChips options={[{ value: "b2b", label: "B2B" }, { value: "b2cs", label: "B2C" }, { value: "exp", label: "Exports" }, { value: "cdn", label: "Credit / debit notes" }, { value: "hsn", label: "HSN summary" }, { value: "docs", label: "Documents issued" }]} value={table} onChange={setTable} />
        <div className="mt-3 overflow-x-auto">
          {table === "b2b" && (
            <table className="w-full text-sm" aria-label="B2B invoices">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Customer</th><th className={`${th} text-left`}>Invoice</th><th className={`${th} text-left`}>Date</th><th className={`${th} text-left`}>POS</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {[...r.b2b, ...r.b2cl.map((g) => ({ ctin: "", name: `B2C large · ${g.pos}`, inv: g.inv }))].flatMap((g) => g.inv.flatMap((i) => i.itms.map((it, k) => (
                  <tr key={`${i.inum}-${k}`}><td className="py-1.5">{k === 0 ? <>{g.name}<span className="block text-xs text-ink-400">{g.ctin}{i.inv_typ && i.inv_typ !== "R" ? ` · ${i.inv_typ}` : ""}</span></> : ""}</td><td className="py-1.5">{k === 0 ? i.inum : ""}</td><td className="py-1.5 whitespace-nowrap">{k === 0 ? i.idt : ""}</td><td className="py-1.5">{i.pos}</td><td className={num}>{it.itm_det.rt}%</td><td className={num}>{money(it.itm_det.txval)}</td><td className={num}>{money(it.itm_det.iamt)}</td><td className={num}>{money(it.itm_det.camt)}</td><td className={num}>{money(it.itm_det.samt)}</td><td className={`${num} font-medium`}>{k === 0 ? money(i.val) : ""}</td></tr>
                ))))}
                {r.b2b.length + r.b2cl.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={10}>No invoice to a registered customer this month.</td></tr>}
              </tbody>
            </table>
          )}
          {table === "b2cs" && (
            <table className="w-full max-w-2xl text-sm" aria-label="B2C small">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supply</th><th className={`${th} text-left`}>POS</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST</th><th className={`${th} text-right`}>Invoices</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {r.b2cs.map((g) => <tr key={`${g.pos}-${g.rt}`}><td className="py-1.5">{g.sply_ty}</td><td className="py-1.5">{g.pos}</td><td className={num}>{g.rt}%</td><td className={num}>{money(g.txval)}</td><td className={num}>{money(g.iamt)}</td><td className={num}>{money(g.camt)}</td><td className={num}>{money(g.samt)}</td><td className={num}>{g.count}</td></tr>)}
                {r.b2cs.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={8}>No unregistered sale this month.</td></tr>}
              </tbody>
            </table>
          )}
          {table === "exp" && (
            <table className="w-full text-sm" aria-label="Exports">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Type</th><th className={`${th} text-left`}>Customer</th><th className={`${th} text-left`}>Invoice</th><th className={`${th} text-left`}>Shipping bill</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {r.exp.flatMap((g) => g.inv.flatMap((i) => i.itms.map((it, k) => (
                  <tr key={`${i.inum}-${k}`}><td className="py-1.5">{k === 0 ? (g.exp_typ === "WPAY" ? "With IGST" : "Under LUT") : ""}</td><td className="py-1.5">{k === 0 ? i.customer : ""}</td><td className="py-1.5">{k === 0 ? <>{i.inum}<span className="block text-xs text-ink-400">{i.idt}</span></> : ""}</td><td className="py-1.5 text-xs">{k === 0 ? (i.sbnum ? `${i.sbnum} · ${i.sbdt}${i.sbpcode ? ` · ${i.sbpcode}` : ""}` : <span className="text-status-warning">not yet</span>) : ""}</td><td className={num}>{it.rt}%</td><td className={num}>{money(it.txval)}</td><td className={num}>{money(it.iamt)}</td><td className={`${num} font-medium`}>{k === 0 ? money(i.val) : ""}</td></tr>
                ))))}
                {r.exp.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={8}>No export this month.</td></tr>}
              </tbody>
            </table>
          )}
          {table === "cdn" && (
            <table className="w-full text-sm" aria-label="Notes">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Party</th><th className={`${th} text-left`}>Note</th><th className={`${th} text-left`}>Against</th><th className={`${th} text-left`}>Reason</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {[...r.cdnr.flatMap((g) => g.nt.map((n) => ({ ...n, gstin: g.ctin, party: g.name }))), ...r.cdnur.map((n) => ({ ...n, gstin: "" }))].map((n) => <tr key={n.nt_num}><td className="py-1.5">{n.party}<span className="block text-xs text-ink-400">{n.gstin || "unregistered"}</span></td><td className="py-1.5">{n.ntty === "C" ? "Credit" : "Debit"} {n.nt_num}<span className="block text-xs text-ink-400">{n.nt_dt}</span></td><td className="py-1.5">{n.against || <span className="text-status-danger">none</span>}</td><td className="py-1.5 text-ink-500">{n.reason}</td><td className={num}>{money(n.val)}</td></tr>)}
                {r.cdnr.length + r.cdnur.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={5}>No credit or debit note this month.</td></tr>}
              </tbody>
            </table>
          )}
          {table === "hsn" && (
            <table className="w-full text-sm" aria-label="HSN summary">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>HSN</th><th className={`${th} text-left`}>Description</th><th className={`${th} text-left`}>UQC</th><th className={`${th} text-right`}>Quantity</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {r.hsn.map((h) => <tr key={`${h.hsn_sc}-${h.rt}-${h.uqc}`}><td className="py-1.5 font-medium">{h.hsn_sc}</td><td className="py-1.5">{h.desc}</td><td className="py-1.5">{h.uqc}</td><td className={num}>{money(h.qty)}</td><td className={num}>{h.rt}%</td><td className={num}>{money(h.txval)}</td><td className={num}>{money(h.iamt)}</td><td className={num}>{money(h.camt)}</td><td className={num}>{money(h.samt)}</td></tr>)}
              </tbody>
            </table>
          )}
          {table === "docs" && (
            <table className="w-full max-w-2xl text-sm" aria-label="Documents issued">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Nature</th><th className={`${th} text-left`}>From</th><th className={`${th} text-left`}>To</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Cancelled</th><th className={`${th} text-right`}>Net issued</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {r.docs.flatMap((d) => d.docs.map((x, i) => <tr key={`${d.doc_num}-${i}`}><td className="py-1.5">{d.doc_typ}</td><td className="py-1.5">{x.from}</td><td className="py-1.5">{x.to}</td><td className={num}>{x.totnum}</td><td className={num}>{x.cancel}</td><td className={num}>{x.net_issue}</td></tr>))}
                {r.docs.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={6}>Nothing issued this month.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

const MATCH_TONE: Record<Gstr2bRow["match"]["status"], "success" | "warning" | "danger"> = { matched: "success", mismatch: "warning", notInBooks: "danger" };
const MATCH_LABEL: Record<Gstr2bRow["match"]["status"], string> = { matched: "matched", mismatch: "tax differs", notInBooks: "not in books" };

function Gstr2bSection({ month }: { month: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<"all" | "mismatch" | "notInBooks" | "missing">("all");
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "gstr2b", month], queryFn: () => accountsService.gstr2b(month) });
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await accountsService.uploadGstr2b(file, month);
      qc.setQueryData([ACCOUNTS_KEY, "gstr2b", r.period], { ...r, periods: q.data?.periods });
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast(`${r.counts.entries} lines read: ${r.counts.matched} matched, ${r.counts.mismatch} with a different tax, ${r.counts.notInBooks} not in the books, ${r.counts.missing} of ours not in 2B`, r.counts.missing || r.counts.mismatch ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the file", "error");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  const again = async () => {
    setBusy(true);
    try { const r = await accountsService.reconcileGstr2b(month); qc.setQueryData([ACCOUNTS_KEY, "gstr2b", month], { ...r, periods: q.data?.periods }); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }); toast("Matched again", "success"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not match", "error"); }
    finally { setBusy(false); }
  };
  if (q.isLoading || !q.data) return <Skeleton className="h-64 w-full" />;
  const d = q.data;
  const rows = show === "all" ? d.rows : show === "missing" ? [] : d.rows.filter((r) => r.match.status === show);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">GSTR-2B · {monthLabel(month)}</h3>
            <p className="text-sm text-ink-500">Input credit may be taken only for what the supplier reported and the portal shows in GSTR-2B. Download the month's GSTR-2B as JSON from the portal (Returns → GSTR-2B → Download) and upload it here.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={ref} type="file" accept=".json,application/json" className="hidden" aria-label="GSTR-2B JSON" onChange={(e) => upload(e.target.files?.[0])} />
            <Button onClick={() => ref.current?.click()} loading={busy}><Upload className="h-4 w-4" /> Upload GSTR-2B JSON</Button>
            {d.uploaded && <Button variant="secondary" onClick={again} loading={busy}><RefreshCw className="h-4 w-4" /> Match again</Button>}
          </div>
        </div>
        {d.uploaded ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="GSTR-2B position">
            <div className="rounded-lg bg-status-successBg px-3 py-2"><span className="text-xs text-ink-500">Matched</span><span className="block font-semibold tabular-nums">{d.counts.matched} · ITC ₹{money(d.itc.matched)}</span></div>
            <div className="rounded-lg bg-status-warningBg px-3 py-2"><span className="text-xs text-ink-500">Tax differs</span><span className="block font-semibold tabular-nums">{d.counts.mismatch} · ₹{money(d.itc.mismatch)}</span></div>
            <div className="rounded-lg bg-status-dangerBg px-3 py-2"><span className="text-xs text-ink-500">In 2B, not in books</span><span className="block font-semibold tabular-nums">{d.counts.notInBooks} · ₹{money(d.itc.notInBooks)}</span></div>
            <div className="rounded-lg bg-status-dangerBg px-3 py-2"><span className="text-xs text-ink-500">Ours, not in 2B (ITC held)</span><span className="block font-semibold tabular-nums">{d.counts.missing} · ₹{money(d.itc.missing)}</span></div>
          </div>
        ) : <p className="mt-3 text-sm text-ink-500">No GSTR-2B uploaded for {monthLabel(month)} yet.{d.periods?.length ? ` Uploaded: ${d.periods.map((p) => p.period).join(", ")}.` : ""}</p>}
        {d.uploaded && d.itc.unavailable > 0 && <p className="mt-2 text-xs text-ink-500">₹{money(d.itc.unavailable)} of tax in 2B is marked "ITC not available" by the portal (see the reason on each line).</p>}
      </Card>
      {d.uploaded && (
        <Card className="p-5">
          <FilterChips options={[{ value: "all", label: `All ${d.counts.entries}` }, { value: "mismatch", label: `Tax differs ${d.counts.mismatch}` }, { value: "notInBooks", label: `Not in books ${d.counts.notInBooks}` }, { value: "missing", label: `Ours, not in 2B ${d.counts.missing}` }]} value={show} onChange={setShow} />
          <div className="mt-3 overflow-x-auto">
            {show === "missing" ? (
              <table className="w-full text-sm" aria-label="Bills not in GSTR-2B">
                <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>Our bill</th><th className={`${th} text-left`}>Their no.</th><th className={`${th} text-left`}>Date</th><th className={`${th} text-right`}>Tax (held)</th><th className={`${th} text-right`}>Value</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {d.missing.map((b) => <tr key={b._id}><td className="py-1.5">{b.supplierName}<span className="block text-xs text-ink-400">{b.supplierGstin}</span></td><td className="py-1.5"><Link to={`/accounts/bills/${b._id}`} className="text-brand-600 hover:underline">{b.billNo}</Link></td><td className="py-1.5">{b.supplierBillNo}</td><td className="py-1.5 whitespace-nowrap">{formatDate(b.billDate)}</td><td className={`${num} text-status-danger font-medium`}>{money(b.tax)}</td><td className={num}>{money(b.grand)}</td></tr>)}
                  {d.missing.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={6}>Every bill of the month with credit is in GSTR-2B.</td></tr>}
                </tbody>
              </table>
            ) : null}
            {show === "missing" && (d.counts.missing > 0 || d.counts.mismatch > 0) && <Gstr2bFollowUps month={month} />}
            {show !== "missing" && (
              <table className="w-full text-sm" aria-label="GSTR-2B lines">
                <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>Their document</th><th className={`${th} text-left`}>Date</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>Tax</th><th className={`${th} text-left pl-3`}>In the books</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((r) => (
                    <tr key={r._id}>
                      <td className="py-1.5">{r.supplierName || r.supplierGstin}<span className="block text-xs text-ink-400">{r.supplierGstin}</span></td>
                      <td className="py-1.5">{r.kind === "creditNote" ? "CN " : r.kind === "debitNote" ? "DN " : ""}{r.number}{!r.itcAvailable && <span className="block text-xs text-status-danger">ITC not available: {r.reason || "as reported"}</span>}</td>
                      <td className="py-1.5 whitespace-nowrap">{r.date ? formatDate(r.date) : "—"}</td>
                      <td className={num}>{money(r.taxable)}</td>
                      <td className={num}>{money(r.tax)}</td>
                      <td className="py-1.5 pl-3"><StatusChip tone={MATCH_TONE[r.match.status]}>{MATCH_LABEL[r.match.status]}</StatusChip>{r.match.docNo && <span className="ml-2">{r.match.docType === "SupplierBill" ? <Link to={`/accounts/bills/${r.match.doc}`} className="text-brand-600 hover:underline">{r.match.docNo}</Link> : r.match.docNo}{r.match.status === "mismatch" && <span className="text-xs text-ink-500"> · books {r.match.diff! > 0 ? "higher" : "lower"} by ₹{money(Math.abs(r.match.diff ?? 0))}</span>}{r.match.note ? <span className="block text-xs text-ink-500">{r.match.note}</span> : r.match.by === "amount" && <span className="text-xs text-ink-400"> · by amount and date</span>}</span>}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={6}>Nothing here.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Rule37Section({ month }: { month: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "itc-reversal", month], queryFn: () => accountsService.itcReversal(month) });
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (fn: () => Promise<{ billNo: string; amount: number; reversed?: number; reclaimed?: number }>, id: string, verb: string) => {
    setBusy(id);
    try {
      const r = await fn();
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      // What still stands reversed on the bill after this step, when the server says.
      const standing = r.reversed === undefined ? null : Math.max(0, round2((r.reversed ?? 0) - (r.reclaimed ?? 0)));
      toast(`${r.billNo}: ₹${money(r.amount)} ${verb} in ${monthLabel(month)}${standing === null ? "" : standing > 0 ? ` · ₹${money(standing)} stands reversed` : " · nothing left reversed"}`, "success");
    }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not record it", "error"); }
    finally { setBusy(null); }
  };
  if (q.isLoading || !q.data) return <Skeleton className="h-64 w-full" />;
  const d = q.data;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold">Credit on bills unpaid 180 days · {monthLabel(month)}</h3>
        <p className="text-sm text-ink-500">A supplier not paid within 180 days of the bill: the credit on the unpaid share goes back in that month's GSTR-3B, with interest, and is claimed again when paid (CGST Rule 37). Recording it here puts the figure on the GST report.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-status-dangerBg px-3 py-2"><span className="text-xs text-ink-500">To reverse</span><span className="block font-semibold tabular-nums">₹{money(d.totals.reverse)}</span></div>
          <div className="rounded-lg bg-status-successBg px-3 py-2"><span className="text-xs text-ink-500">To re-claim (paid since)</span><span className="block font-semibold tabular-nums">₹{money(d.totals.reclaim)}</span></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><span className="text-xs text-ink-500">Reversed this month</span><span className="block font-semibold tabular-nums">₹{money(d.totals.reversed)}</span></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><span className="text-xs text-ink-500">Re-claimed this month</span><span className="block font-semibold tabular-nums">₹{money(d.totals.reclaimed)}</span></div>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold">To reverse</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm" aria-label="ITC to reverse">
            <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Supplier</th><th className={`${th} text-left`}>Bill</th><th className={`${th} text-left`}>180th day</th><th className={`${th} text-right`}>Unpaid</th><th className={`${th} text-right`}>Credit taken</th><th className={`${th} text-right`}>Reverse</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {d.toReverse.map((b) => (
                <tr key={b._id}>
                  <td className="py-1.5">{b.supplierName}</td>
                  <td className="py-1.5"><Link to={`/accounts/bills/${b._id}`} className="text-brand-600 hover:underline">{b.billNo}</Link><span className="block text-xs text-ink-400">{b.supplierBillNo} · {formatDate(b.billDate)}</span></td>
                  <td className="py-1.5 whitespace-nowrap">{formatDate(b.day180)}{!b.inMonth && <span className="block text-xs text-status-danger">{b.overdueDays}d ago, still not reversed</span>}</td>
                  <td className={num}>{money(b.outstanding)}<span className="block text-xs text-ink-400">of {money(b.grand)}</span></td>
                  <td className={num}>{money(b.itc)}</td>
                  <td className={`${num} font-medium text-status-danger`}>
                    {money(b.reverse)}
                    {/* Reversed before: this is what is still to go back, not the whole credit again. */}
                    {(b.reversed ?? 0) > 0 && <span className="block text-xs font-normal text-ink-400">{b.again ? "unpaid again · " : "more · "}{money(b.reversed ?? 0)} reversed{(b.reclaimed ?? 0) > 0 ? `, ${money(b.reclaimed ?? 0)} re-claimed` : ""} so far</span>}
                  </td>
                  <td className="py-1.5 pl-3 text-right"><Button size="sm" variant="secondary" loading={busy === b._id} onClick={() => act(() => accountsService.itcReverse(b._id, month), b._id, "reversed")}>Record reversal</Button></td>
                </tr>
              ))}
              {d.toReverse.length === 0 && <tr><td className="py-3 text-ink-400" colSpan={7}>No bill with credit is unpaid past 180 days.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {(d.toReclaim.length > 0 || d.done.reversed.length > 0 || d.done.reclaimed.length > 0) && (
        <Card className="p-5">
          <h3 className="font-semibold">To re-claim, and what was recorded</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm" aria-label="ITC to re-claim">
              <tbody className="divide-y divide-ink-100">
                {d.toReclaim.map((b) => <tr key={b._id}><td className="py-1.5">{b.supplierName}</td><td className="py-1.5"><Link to={`/accounts/bills/${b._id}`} className="text-brand-600 hover:underline">{b.billNo}</Link><span className="block text-xs text-ink-400">reversed ₹{money(b.reversed)}{b.reversedPeriod ? ` in ${b.reversedPeriod}` : ""}{(b.reclaimed ?? 0) > 0 ? ` · ₹${money(b.reclaimed ?? 0)} re-claimed so far` : ""}{b.fully ? " · now paid in full" : ` · ₹${money(b.outstanding)} still unpaid, its credit stays reversed`}</span></td><td className={`${num} font-medium text-status-success`}>re-claim {money(b.reclaim)}</td><td className="py-1.5 pl-3 text-right"><Button size="sm" variant="secondary" loading={busy === b._id} onClick={() => act(() => accountsService.itcReclaim(b._id, month), b._id, "re-claimed")}>Record re-claim</Button></td></tr>)}
                {d.done.reversed.map((b) => <tr key={`r${b._id}`} className="text-ink-500"><td className="py-1.5">{b.supplierName}</td><td className="py-1.5">{b.billNo}</td><td className={num}>reversed {money(b.amount)}</td><td className="py-1.5 pl-3 text-right text-xs">{formatDate(b.at)}</td></tr>)}
                {d.done.reclaimed.map((b) => <tr key={`c${b._id}`} className="text-ink-500"><td className="py-1.5">{b.supplierName}</td><td className="py-1.5">{b.billNo}</td><td className={num}>re-claimed {money(b.amount)}</td><td className="py-1.5 pl-3 text-right text-xs">{formatDate(b.at)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/** Per supplier, a message asking them to report or amend what our 2B is missing — to copy, WhatsApp or mail. */
function Gstr2bFollowUps({ month }: { month: string }) {
  const { toast } = useToast();
  const q = useQuery({ queryKey: [ACCOUNTS_KEY, "gstr2b-follow-ups", month], queryFn: () => accountsService.gstr2bFollowUps(month) });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data?.length) return null;
  const wa = (phone: string, text: string) => {
    const digits = phone.replace(/\D/g, "");
    return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(text)}`;
  };
  return (
    <section className="mt-4 space-y-2" aria-label="Follow up with suppliers">
      <h4 className="font-semibold">Ask the suppliers to report them</h4>
      {q.data.map((f) => (
        <div key={f.supplier} className="rounded-lg border border-ink-200 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{f.name}</span>
            <span className="text-xs text-ink-400">{f.bills.length} bill{f.bills.length === 1 ? "" : "s"} · GST ₹{money(f.tax)} held</span>
            <span className="ml-auto flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === f.supplier ? null : f.supplier)}>{open === f.supplier ? "Hide" : "Show"} the message</Button>
              <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(f.message).then(() => toast("Copied", "success"), () => undefined); }}>Copy</Button>
              {f.phone && <a className="rounded-lg px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50" href={wa(f.phone, f.message)} target="_blank" rel="noreferrer">WhatsApp</a>}
              {f.email && <a className="rounded-lg px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50" href={`mailto:${f.email}?subject=${encodeURIComponent(f.subject)}&body=${encodeURIComponent(f.message)}`}>Email</a>}
            </span>
          </div>
          {open === f.supplier && <pre className="mt-2 whitespace-pre-wrap rounded bg-ink-50 p-2 font-sans text-xs text-ink-700">{f.message}</pre>}
        </div>
      ))}
    </section>
  );
}
