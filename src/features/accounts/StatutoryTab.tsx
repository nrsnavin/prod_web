import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileJson, Upload, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import type { Gstr2bRow, MsmeDue } from "./types";

type Section = "msme" | "gstr1" | "gstr2b" | "rule37";

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
  const [section, setSection] = useState<Section>("msme");
  const [month, setMonth] = useState(lastMonth());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterChips options={[{ value: "msme", label: "MSME 45 days" }, { value: "gstr1", label: "GSTR-1" }, { value: "gstr2b", label: "GSTR-2B" }, { value: "rule37", label: "ITC unpaid 180 days" }]} value={section} onChange={setSection} />
        {section !== "msme" && <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value || lastMonth())} />}
      </div>
      {section === "msme" && <MsmeSection />}
      {section === "gstr1" && <Gstr1Section month={month} />}
      {section === "gstr2b" && <Gstr2bSection month={month} />}
      {section === "rule37" && <Rule37Section month={month} />}
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
  const [table, setTable] = useState<"b2b" | "b2cs" | "cdn" | "hsn" | "docs">("b2b");
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
              {([["b2b", "4 · B2B (registered)"], ["b2cl", "5 · B2C large (inter-state, over ₹1 lakh)"], ["b2cs", "7 · B2C small"], ["cdnr", "9B · Notes to registered"], ["cdnur", "9B · Notes to unregistered"]] as const).map(([k, label]) => (
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
        <FilterChips options={[{ value: "b2b", label: "B2B" }, { value: "b2cs", label: "B2C" }, { value: "cdn", label: "Credit / debit notes" }, { value: "hsn", label: "HSN summary" }, { value: "docs", label: "Documents issued" }]} value={table} onChange={setTable} />
        <div className="mt-3 overflow-x-auto">
          {table === "b2b" && (
            <table className="w-full text-sm" aria-label="B2B invoices">
              <thead><tr className="border-y border-ink-200"><th className={`${th} text-left`}>Customer</th><th className={`${th} text-left`}>Invoice</th><th className={`${th} text-left`}>Date</th><th className={`${th} text-left`}>POS</th><th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Taxable</th><th className={`${th} text-right`}>IGST</th><th className={`${th} text-right`}>CGST</th><th className={`${th} text-right`}>SGST</th><th className={`${th} text-right`}>Value</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {[...r.b2b, ...r.b2cl.map((g) => ({ ctin: "", name: `B2C large · ${g.pos}`, inv: g.inv }))].flatMap((g) => g.inv.flatMap((i) => i.itms.map((it, k) => (
                  <tr key={`${i.inum}-${k}`}><td className="py-1.5">{k === 0 ? <>{g.name}<span className="block text-xs text-ink-400">{g.ctin}</span></> : ""}</td><td className="py-1.5">{k === 0 ? i.inum : ""}</td><td className="py-1.5 whitespace-nowrap">{k === 0 ? i.idt : ""}</td><td className="py-1.5">{i.pos}</td><td className={num}>{it.itm_det.rt}%</td><td className={num}>{money(it.itm_det.txval)}</td><td className={num}>{money(it.itm_det.iamt)}</td><td className={num}>{money(it.itm_det.camt)}</td><td className={num}>{money(it.itm_det.samt)}</td><td className={`${num} font-medium`}>{k === 0 ? money(i.val) : ""}</td></tr>
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
            ) : (
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
                      <td className="py-1.5 pl-3"><StatusChip tone={MATCH_TONE[r.match.status]}>{MATCH_LABEL[r.match.status]}</StatusChip>{r.match.docNo && <span className="ml-2">{r.match.docType === "SupplierBill" ? <Link to={`/accounts/bills/${r.match.doc}`} className="text-brand-600 hover:underline">{r.match.docNo}</Link> : r.match.docNo}{r.match.status === "mismatch" && <span className="text-xs text-ink-500"> · books {r.match.diff! > 0 ? "higher" : "lower"} by ₹{money(Math.abs(r.match.diff ?? 0))}</span>}{r.match.by === "amount" && <span className="text-xs text-ink-400"> · by amount and date</span>}</span>}</td>
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
  const act = async (fn: () => Promise<{ billNo: string; amount: number }>, id: string, verb: string) => {
    setBusy(id);
    try { const r = await fn(); qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] }); toast(`${r.billNo}: ₹${money(r.amount)} ${verb} in ${monthLabel(month)}`, "success"); }
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
                  <td className={`${num} font-medium text-status-danger`}>{money(b.reverse)}</td>
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
                {d.toReclaim.map((b) => <tr key={b._id}><td className="py-1.5">{b.supplierName}</td><td className="py-1.5"><Link to={`/accounts/bills/${b._id}`} className="text-brand-600 hover:underline">{b.billNo}</Link><span className="block text-xs text-ink-400">reversed ₹{money(b.reversed)} in {b.reversedPeriod}{b.fully ? " · now paid in full" : ` · ₹${money(b.outstanding)} still unpaid`}</span></td><td className={`${num} font-medium text-status-success`}>re-claim {money(b.reclaim)}</td><td className="py-1.5 pl-3 text-right"><Button size="sm" variant="secondary" loading={busy === b._id} onClick={() => act(() => accountsService.itcReclaim(b._id, month), b._id, "re-claimed")}>Record re-claim</Button></td></tr>)}
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
