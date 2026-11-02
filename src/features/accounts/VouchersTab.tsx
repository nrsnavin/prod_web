import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormScreen } from "@/components/ui/FormScreen";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { round2 } from "@/features/invoices/gst";
import { useAccountsMutations, useBankAccounts, useOpenDocs, usePayments } from "./hooks";
import { PartyPicker, money, today } from "./shared";
import type { OpenDoc, Payment, PaymentMode, VoucherKind } from "./types";

const columns: Column<Payment>[] = [
  { key: "no", header: "Voucher", render: (p) => <span className="font-medium">{p.voucherNo}</span> },
  { key: "date", header: "Date", render: (p) => formatDate(p.date) },
  { key: "party", header: "Party", render: (p) => p.partyName },
  { key: "amount", header: "Amount (₹)", align: "right", render: (p) => <span className={p.kind === "receipt" ? "text-status-success" : ""}>{p.kind === "receipt" ? "+" : "−"}{money(p.amount)}</span> },
  { key: "tds", header: "TDS (₹)", align: "right", render: (p) => (p.tds?.amount ? money(p.tds.amount) : "—") },
  { key: "mode", header: "Through", render: (p) => `${p.accountName || "—"} · ${p.mode}${p.reference ? ` · ${p.reference}` : ""}` },
  { key: "docs", header: "Settles", render: (p) => p.allocations.map((a) => a.docNo).join(", ") || (p.unallocated ? "On account" : "—"), cellClassName: "whitespace-normal" },
  { key: "status", header: "Status", render: (p) => <StatusChip tone={p.status === "posted" ? "success" : "danger"}>{p.status}</StatusChip> },
];

export function VouchersTab() {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<VoucherKind | "all">("all");
  const [search, setSearch] = useState("");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data, isLoading } = usePayments({ page, kind, search });
  const creating = params.get("new") === "receipt" || params.get("new") === "payment" ? (params.get("new") as VoucherKind) : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Voucher no., party, reference, document…" className="w-full max-w-xs" />
        <FilterChips options={[{ value: "all", label: "All" }, { value: "receipt", label: "Receipts" }, { value: "payment", label: "Payments" }]} value={kind} onChange={(v) => { setKind(v); setPage(1); }} />
        <span className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => setParams({ new: "receipt" })}><Plus className="h-4 w-4" /> Receipt</Button>
          <Button onClick={() => setParams({ new: "payment" })}><Plus className="h-4 w-4" /> Payment</Button>
        </span>
      </div>
      <Card>
        <DataTable columns={columns} rows={data?.payments ?? []} rowKey={(p) => p._id} onRowClick={(p) => navigate(`/accounts/payments/${p._id}`)} loading={isLoading}
          emptyTitle="No vouchers yet" emptyDescription="Record a customer's payment as a receipt, and what you pay out as a payment." />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>
      <FormScreen open={!!creating} onClose={() => setParams({})} title={creating === "receipt" ? "Record a receipt" : "Record a payment"} width="max-w-4xl">
        {creating && <VoucherForm kind={creating} onDone={(id) => { setParams({}); navigate(`/accounts/payments/${id}`); }} onCancel={() => setParams({})} />}
      </FormScreen>
    </>
  );
}

/**
 * A receipt from a customer or a payment to a supplier (or anyone), with
 * the open documents it settles ticked and the amount against each —
 * never more than is owed. On a payment, the TDS rate deducts from the
 * gross each ticked bill is settled by; the cash paid is the rest.
 */
export function VoucherForm({ kind, onDone, onCancel, initialParty }: { kind: VoucherKind; onDone: (id: string) => void; onCancel: () => void; initialParty?: { id: string; name: string } }) {
  const { toast } = useToast();
  const { createPayment } = useAccountsMutations();
  const { data: accounts } = useBankAccounts();
  const partyType = kind === "receipt" ? "customer" : "supplier";
  const [other, setOther] = useState(false);
  const [party, setParty] = useState(initialParty?.id ?? "");
  const [partyName, setPartyName] = useState(initialParty?.name ?? "");
  const { data: open, isLoading: loadingDocs } = useOpenDocs(!other && party ? partyType : undefined, !other && party ? party : undefined);
  const [picked, setPicked] = useState<Record<string, number | "">>({});
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState<PaymentMode>("bank");
  const [account, setAccount] = useState("");
  const [reference, setReference] = useState("");
  const [tdsRate, setTdsRate] = useState<number | "">("");
  const [tdsSection, setTdsSection] = useState("194C");
  const [amount, setAmount] = useState<number | "">("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [narration, setNarration] = useState("");

  useEffect(() => { setPicked({}); setAmountTouched(false); }, [party, other]);

  const docs: OpenDoc[] = open?.docs ?? [];
  const rate = kind === "payment" ? Number(tdsRate) || 0 : 0;
  // Per allocation: gross settled, the TDS on it, and the cash it takes.
  const allocs = useMemo(() => docs.filter((d) => picked[d.id] !== undefined && picked[d.id] !== "").map((d) => {
    const gross = round2(Number(picked[d.id]));
    const docRate = d.docType === "SupplierBill" ? (rate || d.tds?.rate || 0) : d.docType === "Expense" ? rate : 0;
    const tds = round2(gross * docRate / 100);
    return { doc: d, gross, tds, cash: round2(gross - tds), over: gross > d.outstanding + 0.005 };
  }), [docs, picked, rate]);
  const gross = round2(allocs.reduce((s, a) => s + a.gross, 0));
  const tdsTotal = round2(allocs.reduce((s, a) => s + a.tds, 0));
  const cashNeeded = round2(gross - tdsTotal);
  const cash = amountTouched ? Number(amount) || 0 : cashNeeded;
  const unallocated = round2(cash + tdsTotal - gross);
  const accountList = (accounts ?? []).filter((a) => a.active !== false);
  const chosenAccount = account || accountList.find((a) => a.isDefault)?._id || accountList[0]?._id || "";
  const problems = [
    ...allocs.filter((a) => a.over).map((a) => `${a.doc.docNo} has only ₹${money(a.doc.outstanding)} outstanding`),
    ...(cash + 0.005 < cashNeeded ? [`The ticked documents need ₹${money(cashNeeded)}; the voucher is for ₹${money(cash)}`] : []),
  ];
  const ready = (other ? partyName.trim() : party) && chosenAccount && cash > 0 && problems.length === 0 && !createPayment.isPending;

  const tick = (d: OpenDoc, on: boolean) => setPicked((p) => { const next = { ...p }; if (on) next[d.id] = d.outstanding; else delete next[d.id]; return next; });

  const submit = () =>
    createPayment.mutate(
      {
        kind, date, partyType: other ? "other" : partyType, ...(other ? { partyName: partyName.trim() } : partyType === "customer" ? { customer: party } : { supplier: party }),
        amount: cash, mode, account: chosenAccount, reference: reference.trim() || undefined,
        tds: kind === "payment" && rate > 0 ? { section: tdsSection.trim(), rate } : undefined,
        allocations: allocs.map((a) => ({ docType: a.doc.docType, doc: a.doc.id, amount: a.gross })),
        narration: narration.trim() || undefined,
      },
      {
        onSuccess: (p) => { toast(`${p.voucherNo} posted`, "success"); onDone(p._id); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Could not post the voucher", "error"),
      }
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {other ? (
          <Input label="Paid to" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
        ) : (
          <PartyPicker partyType={partyType} value={party} onChange={(id, name) => { setParty(id); setPartyName(name); }} />
        )}
        {kind === "payment" && (
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={other} onChange={(e) => { setOther(e.target.checked); setParty(""); }} /> Not a supplier on file</label>
        )}
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Through account" value={chosenAccount} onChange={(e) => setAccount(e.target.value)} options={accountList.map((a) => ({ value: a._id, label: `${a.name} (₹${money(a.balance)})` }))} />
        <Select label="Mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} options={[{ value: "bank", label: "Bank transfer (NEFT / RTGS / IMPS)" }, { value: "upi", label: "UPI" }, { value: "cheque", label: "Cheque" }, { value: "cash", label: "Cash" }]} />
        <Input label="Reference (UTR / cheque no.)" value={reference} onChange={(e) => setReference(e.target.value)} />
        {kind === "payment" && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="TDS section" value={tdsSection} onChange={(e) => setTdsSection(e.target.value)} />
            <Input label="TDS rate %" type="number" step="0.01" min={0} max={100} value={tdsRate} placeholder="none" onChange={(e) => setTdsRate(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        )}
      </div>

      {!other && party && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Settles</p>
          {loadingDocs ? <Skeleton className="h-20 w-full" /> : docs.length === 0 ? (
            <p className="text-sm text-ink-400">Nothing open for {partyName || "this party"}{open ? ` — balance on account ₹${money(open.balance)}` : ""}. The amount stays on account.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2" /><th className="py-2 text-left font-medium">Document</th><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-right font-medium">Outstanding</th>
                    <th className="py-2 text-right font-medium">Settle (gross)</th>{kind === "payment" && <th className="py-2 text-right font-medium">TDS</th>}{kind === "payment" && <th className="py-2 text-right font-medium">Pay</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {docs.map((d) => {
                    const a = allocs.find((x) => x.doc.id === d.id);
                    return (
                      <tr key={d.id} className={d.overdueDays > 0 ? "" : ""}>
                        <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Settle ${d.docNo}`} checked={picked[d.id] !== undefined} onChange={(e) => tick(d, e.target.checked)} /></td>
                        <td className="py-1.5 pr-2"><span className="font-medium">{d.docNo}</span>{d.refNo ? <span className="text-ink-400"> · {d.refNo}</span> : null}{d.description ? <span className="block text-xs text-ink-400">{d.description}</span> : null}</td>
                        <td className="py-1.5 pr-2 text-ink-500">{formatDate(d.date)}{d.overdueDays > 0 && <StatusChip tone={d.overdueDays > 60 ? "danger" : "warning"} className="ml-1">{d.overdueDays}d overdue</StatusChip>}</td>
                        <td className="py-1.5 text-right tabular-nums">{money(d.outstanding)}</td>
                        <td className="py-1.5 text-right">
                          <Input aria-label={`Amount for ${d.docNo}`} type="number" step="0.01" min={0} className="w-32 text-right" disabled={picked[d.id] === undefined} value={picked[d.id] ?? ""}
                            onChange={(e) => setPicked((p) => ({ ...p, [d.id]: e.target.value === "" ? "" : Number(e.target.value) }))} error={a?.over ? "over" : undefined} />
                        </td>
                        {kind === "payment" && <td className="py-1.5 text-right tabular-nums">{a ? money(a.tds) : "—"}</td>}
                        {kind === "payment" && <td className="py-1.5 text-right tabular-nums font-medium">{a ? money(a.cash) : "—"}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Input label={kind === "receipt" ? "Amount received *" : "Amount paid *"} type="number" step="0.01" min={0} value={amountTouched ? amount : cashNeeded || ""} onChange={(e) => { setAmountTouched(true); setAmount(e.target.value === "" ? "" : Number(e.target.value)); }} />
        <dl className="text-sm sm:col-span-2 self-end" aria-label="Voucher summary">
          {kind === "payment" && tdsTotal > 0 && <div className="flex justify-between"><dt className="text-ink-500">TDS deducted</dt><dd className="tabular-nums">₹{money(tdsTotal)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-500">Settles</dt><dd className="tabular-nums">₹{money(gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Left on account</dt><dd className={`tabular-nums ${unallocated > 0 ? "text-status-warning" : ""}`}>₹{money(Math.max(0, unallocated))}</dd></div>
        </dl>
      </div>
      {problems.map((p) => <p key={p} className="text-sm text-status-danger">{p}</p>)}
      <Input label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Printed on the statement" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!ready} loading={createPayment.isPending}>{kind === "receipt" ? "Post receipt" : "Post payment"}</Button>
      </div>
    </div>
  );
}
