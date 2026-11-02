import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { accountsService } from "./api";
import { ACCOUNTS_KEY, useCategories } from "./hooks";
import { PartyPicker, money } from "./shared";
import type { RecurringExpense } from "./types";

const EVERY: Record<number, string> = { 1: "Every month", 3: "Every quarter", 6: "Every six months", 12: "Every year" };
const nameOf = (x: unknown) => (x && typeof x === "object" && "name" in (x as object) ? String((x as { name: string }).name) : "");

/**
 * Rent, electricity, a loan EMI, insurance: each drafts its expense on
 * its day, waiting for approval like any other, and the forecast counts
 * what is coming.
 */
export function RecurringTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "recurring"], queryFn: accountsService.recurring });
  const [editing, setEditing] = useState<Partial<RecurringExpense> | null>(null);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const r = await accountsService.runRecurring();
      toast(r.drafted.length ? `Drafted ${r.drafted.join(", ")}` : "Nothing is due yet", r.drafted.length ? "success" : "info");
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not draft", "error"); } finally { setRunning(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink-500">Each one drafts its expense on its day and waits for approval.</p>
        <span className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={run} loading={running}><RefreshCw className="h-4 w-4" /> Draft what is due</Button>
          <Button onClick={() => setEditing({ every: 1, active: true })}><Plus className="h-4 w-4" /> Recurring expense</Button>
        </span>
      </div>
      {isLoading ? <Skeleton className="h-40 w-full" /> : (data ?? []).length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-400">No recurring expenses yet — add rent, electricity, a loan EMI.</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {(data ?? []).map((r) => (
              <li key={r._id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${r.active ? "" : "opacity-60"}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name} <span className="font-normal text-ink-400">· {nameOf(r.category)}</span></p>
                  <p className="text-xs text-ink-400">{EVERY[r.every]} on day {r.dayOfMonth} · next {formatDate(r.nextDate)}{r.lastDrafted?.expenseNo ? ` · last ${r.lastDrafted.expenseNo}` : ""}{r.payeeName || nameOf(r.supplier) ? ` · ${r.payeeName || nameOf(r.supplier)}` : ""}</p>
                </div>
                <span className="tabular-nums font-semibold">₹{money(r.amount * (1 + (r.gstPercent ?? 0) / 100))}</span>
                {!r.active && <StatusChip tone="neutral">stopped</StatusChip>}
                <Button size="sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && <RecurringDialog initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RecurringDialog({ initial, onClose }: { initial: Partial<RecurringExpense>; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const idOf = (x: unknown) => (x && typeof x === "object" ? (x as { _id: string })._id : (x as string) || "");
  const [f, setF] = useState({
    name: initial.name ?? "", category: idOf(initial.category), description: initial.description ?? "", supplier: idOf(initial.supplier),
    payeeName: initial.payeeName ?? "", amount: initial.amount ?? ("" as number | ""), gstPercent: initial.gstPercent ?? 0,
    every: String(initial.every ?? 1), nextDate: initial.nextDate ? initial.nextDate.slice(0, 10) : "", endDate: initial.endDate ? initial.endDate.slice(0, 10) : "", active: initial.active !== false,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const ready = f.name.trim() && f.category && f.description.trim() && Number(f.amount) > 0 && f.nextDate;
  const save = async () => {
    setBusy(true);
    try {
      await accountsService.saveRecurring(initial._id, {
        name: f.name.trim(), category: f.category, description: f.description.trim(), supplier: f.supplier || null, payeeName: f.payeeName.trim(),
        amount: Number(f.amount), gstPercent: Number(f.gstPercent) || 0, every: Number(f.every), nextDate: f.nextDate, endDate: f.endDate || null, active: f.active,
        dayOfMonth: Math.min(28, new Date(f.nextDate).getDate()),
      });
      qc.invalidateQueries({ queryKey: [ACCOUNTS_KEY] });
      toast("Saved", "success");
      onClose();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={initial._id ? `Edit ${initial.name}` : "New recurring expense"} width="max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name *" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Factory rent" />
        <Select label="Head *" value={f.category} onChange={(e) => set("category", e.target.value)} options={(categories ?? []).filter((c) => c.active !== false).map((c) => ({ value: c._id, label: c.name }))} placeholder="Pick a head" />
        <Input label="What for *" value={f.description} onChange={(e) => set("description", e.target.value)} />
        <PartyPicker partyType="supplier" label="Supplier on file (optional)" value={f.supplier} onChange={(id, name) => { set("supplier", id); if (name) set("payeeName", name); }} />
        <Input label="Paid to" value={f.payeeName} onChange={(e) => set("payeeName", e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Amount before GST *" type="number" min={0} value={f.amount} onChange={(e) => set("amount", e.target.value === "" ? "" : Number(e.target.value))} />
          <Input label="GST %" type="number" min={0} max={100} value={f.gstPercent} onChange={(e) => set("gstPercent", Number(e.target.value))} />
        </div>
        <Select label="How often" value={f.every} onChange={(e) => set("every", e.target.value)} options={Object.entries(EVERY).map(([v, l]) => ({ value: v, label: l }))} />
        <Input label="Next on *" type="date" value={f.nextDate} onChange={(e) => set("nextDate", e.target.value)} hint="Days after the 28th fall on the 28th" />
        <Input label="Until (optional)" type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} />
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!ready} loading={busy}>Save</Button>
      </div>
    </Modal>
  );
}
