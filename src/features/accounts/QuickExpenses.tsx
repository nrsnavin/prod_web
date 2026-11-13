import { useRef, useState } from "react";
import { Mic, MicOff, Receipt, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useSpeech } from "@/core/hooks/useSpeech";
import { accountsService } from "./api";
import { useCategories } from "./hooks";
import { money } from "./shared";
import type { ScanDraft } from "./ScanBill";
import type { ScanResult } from "./types";

// ══════════════════════════════════════════════════════════════════
//  QUICKER EXPENSES
//
//  Petty cash in one line — "Paid 350 auto for yarn", typed or spoken —
//  read on the server into the expense form, filled in and paid from the
//  cash box (services/cashLine.js). And a week's receipts read together:
//  each photo becomes its own draft, listed for a look and saved in one
//  go. Nothing is saved until the person says so.
// ══════════════════════════════════════════════════════════════════

const todayIso = () => new Date().toISOString().slice(0, 10);

/** One line of cash spent, into the expense form. */
export function CashLineBox({ onDraft }: { onDraft: (draft: ScanDraft, category: string | undefined) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const speech = useSpeech((said) => setText((t) => (t ? `${t} ${said}` : said)));
  const read = async () => {
    const line = text.trim();
    if (!line) return;
    setBusy(true);
    try {
      const r = await accountsService.expenseFromLine(line);
      if (!r.draft) { toast(r.problems[0] ?? "Could not read that", "error"); return; }
      const d = r.draft;
      onDraft({
        supplierName: d.payee, supplierGstin: "", billNo: "", billDate: d.date,
        lines: [{ description: d.description, quantity: 1, rate: d.amount ?? "", gstPercent: 0 }],
        aiSuggestion: r.aiSuggestion, kind: "receipt", source: "line", paidInCash: true,
      }, d.category?._id);
      if (r.problems.length) toast(r.problems.join(". "), "info");
      setText("");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not read that", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="flex w-full flex-wrap items-end gap-2 sm:w-auto" onSubmit={(e) => { e.preventDefault(); void read(); }} aria-label="Petty cash in one line">
      <Input label="Spent cash? Type or say it" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Paid 350 auto for yarn" wrapperClassName="min-w-0 flex-1 sm:w-80 sm:flex-none" />
      {speech.supported && (
        <Button type="button" variant={speech.listening ? "danger" : "secondary"} aria-label={speech.listening ? "Stop listening" : "Say it"} onClick={() => (speech.listening ? speech.stop() : speech.start("en-IN"))}>
          {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
      )}
      <Button type="submit" variant="secondary" loading={busy} disabled={!text.trim()}><Sparkles className="h-4 w-4" /> Fill the form</Button>
    </form>
  );
}

interface Row {
  key: string;
  file: File;
  state: "reading" | "read" | "failed";
  message?: string;
  result?: ScanResult;
  include: boolean;
  category: string;
  description: string;
  payee: string;
  date: string;
  amount: number | "";
  refNo: string;
}

/** What one read receipt comes to: the printed total, else its lines with their GST. */
function totalOf(r: ScanResult): number | "" {
  if (r.read.totals.grand != null) return r.read.totals.grand;
  const sum = r.read.lines.reduce((s, l) => s + (Number(l.rate) || 0) * (Number(l.quantity) || 1) * (1 + (Number(l.gstPercent) || 0) / 100), 0);
  return sum > 0 ? Math.round(sum * 100) / 100 : "";
}

/** Several receipts photographed together, each read into its own draft. */
export function ReceiptsBatchDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const { data: categories } = useCategories();
  const ref = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const pick = async (files: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 10) : [];
    if (!list.length) return;
    const fresh: Row[] = list.map((file, i) => ({ key: `${Date.now()}-${i}`, file, state: "reading", include: false, category: "", description: "", payee: "", date: todayIso(), amount: "", refNo: "" }));
    setRows(fresh);
    // One at a time: each is one reading on the server, and the list fills as they come.
    for (const row of fresh) {
      try {
        const r = await accountsService.scan([row.file]);
        if (r.read.problem) { patch(row.key, { state: "failed", message: r.read.problem === "not_a_bill" ? "Not a receipt" : "Could not be read" }); continue; }
        const description = r.read.lines.length === 1 ? r.read.lines[0].description : r.read.lines.map((l) => l.description).slice(0, 3).join(", ");
        const payee = r.supplier?.name ?? r.read.supplierName;
        const held = (r.samePhoto?.length ?? 0) > 0;
        patch(row.key, {
          state: "read", result: r, description, payee, date: r.read.billDate ?? todayIso(), amount: totalOf(r), refNo: r.read.billNo,
          include: !held, message: held ? `Already entered as ${r.samePhoto!.map((s) => s.docNo).join(", ")}` : undefined,
        });
        const s = await accountsService.suggestCategory({ payee: payee || undefined, description: description || undefined }).catch(() => null);
        if (s) setRows((rs) => rs.map((x) => (x.key === row.key && !x.category ? { ...x, category: s.category } : x)));
      } catch (e) {
        patch(row.key, { state: "failed", message: e instanceof ApiError ? e.message : "Could not be read" });
      }
    }
  };

  const chosen = rows.filter((r) => r.include && r.state === "read");
  const missing = chosen.filter((r) => !r.category || !(Number(r.amount) > 0) || !r.description.trim());
  const save = async () => {
    setSaving(true);
    let saved = 0;
    const failed: string[] = [];
    for (const r of chosen) {
      try {
        await accountsService.createExpense({
          category: r.category, description: r.description.trim(), date: r.date, payeeName: r.payee.trim() || undefined, refNo: r.refNo.trim() || undefined,
          amount: Number(r.amount), gstPercent: 0, source: "scan", aiSuggestion: r.result?.aiSuggestion ?? undefined,
          requestId: `receipts:${r.key}`,
        });
        saved += 1;
        patch(r.key, { include: false, state: "read", message: "Saved" });
      } catch (e) {
        failed.push(`${r.file.name}: ${e instanceof ApiError ? e.message : "not saved"}`);
      }
    }
    setSaving(false);
    toast(failed.length ? `${saved} saved; ${failed.length} not: ${failed.join("; ")}` : `${saved} expense${saved === 1 ? "" : "s"} saved`, failed.length ? "error" : "success");
    if (saved) onSaved();
    if (!failed.length) onClose();
  };

  const heads = (categories ?? []).filter((c) => c.active !== false);
  return (
    <Modal open onClose={onClose} title="Several receipts at once" width="max-w-5xl" confirmDirtyClose={chosen.length > 0}>
      <div className="space-y-3">
        <input ref={ref} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" aria-label="Receipt photos" onChange={(e) => void pick(e.target.files)} />
        {!rows.length ? (
          <div className="rounded-lg border border-dashed border-ink-300 p-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-ink-300" aria-hidden />
            <p className="mt-2 text-sm text-ink-500">Up to 10 receipt photos or PDFs. Each is read into its own expense; check the head and amount, then save them together.</p>
            <Button className="mt-3" onClick={() => ref.current?.click()}>Choose receipts</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Receipts read">
              <thead><tr className="border-b border-ink-200 text-left text-xs font-medium text-ink-500"><th className="py-1 pr-2">Save</th><th className="py-1 pr-2">Receipt</th><th className="py-1 pr-2">Head *</th><th className="py-1 pr-2">What for *</th><th className="py-1 pr-2">Paid to</th><th className="py-1 pr-2">Date</th><th className="py-1 text-right">Amount ₹ *</th></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.key} className="align-top">
                    <td className="py-2 pr-2"><input type="checkbox" aria-label={`Save ${r.file.name}`} checked={r.include} disabled={r.state !== "read" || r.message === "Saved"} onChange={(e) => patch(r.key, { include: e.target.checked })} /></td>
                    <td className="py-2 pr-2">
                      <span className="block max-w-[10rem] truncate">{r.file.name}</span>
                      {r.state === "reading" && <StatusChip tone="info">reading…</StatusChip>}
                      {r.message && <span className={`block text-xs ${r.message === "Saved" ? "text-status-success" : "text-status-warning"}`}>{r.message}</span>}
                      {r.result?.checks && !r.result.checks.ok && <span className="block text-xs text-status-danger">Figures do not add up</span>}
                    </td>
                    <td className="py-2 pr-2">
                      <select aria-label={`Head for ${r.file.name}`} className="w-40 rounded-lg border border-ink-200 bg-surface px-2 py-1.5" value={r.category} disabled={r.state !== "read"} onChange={(e) => patch(r.key, { category: e.target.value })}>
                        <option value="">Pick a head</option>
                        {heads.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2"><input aria-label={`What ${r.file.name} was for`} className="w-44 rounded-lg border border-ink-200 bg-surface px-2 py-1.5" value={r.description} disabled={r.state !== "read"} onChange={(e) => patch(r.key, { description: e.target.value })} /></td>
                    <td className="py-2 pr-2"><input aria-label={`Who ${r.file.name} was paid to`} className="w-36 rounded-lg border border-ink-200 bg-surface px-2 py-1.5" value={r.payee} disabled={r.state !== "read"} onChange={(e) => patch(r.key, { payee: e.target.value })} /></td>
                    <td className="py-2 pr-2"><input type="date" aria-label={`Date of ${r.file.name}`} className="rounded-lg border border-ink-200 bg-surface px-2 py-1.5" value={r.date} disabled={r.state !== "read"} onChange={(e) => patch(r.key, { date: e.target.value })} /></td>
                    <td className="py-2 text-right"><input type="number" min={0} step="0.01" aria-label={`Amount of ${r.file.name}`} className="w-28 rounded-lg border border-ink-200 bg-surface px-2 py-1.5 text-right tabular-nums" value={r.amount} disabled={r.state !== "read"} onChange={(e) => patch(r.key, { amount: e.target.value === "" ? "" : Number(e.target.value) })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-sm text-ink-500">{chosen.length} to save{chosen.length ? `, ₹${money(chosen.reduce((s, r) => s + (Number(r.amount) || 0), 0))}` : ""}{missing.length ? ` · ${missing.length} need a head, an amount or what for` : ""}</span>
            <Button variant="secondary" onClick={() => { setRows([]); ref.current?.click(); }} disabled={saving}>Choose others</Button>
            <Button onClick={() => void save()} loading={saving} disabled={!chosen.length || missing.length > 0}>Save {chosen.length} expense{chosen.length === 1 ? "" : "s"}</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
