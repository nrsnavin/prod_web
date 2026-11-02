import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { useAccountsMutations, useBankAccounts, useCategories } from "./hooks";
import { money } from "./shared";
import { BooksSettings } from "./BooksSettings";
import { AiAccuracy } from "./AiAccuracy";
import type { AccountKind, BankAccount, ExpenseCategory } from "./types";

function AccountDialog({ initial, onClose }: { initial: Partial<BankAccount> | null; onClose: () => void }) {
  const { toast } = useToast();
  const { saveBankAccount } = useAccountsMutations();
  const [form, setForm] = useState<Partial<BankAccount>>({ kind: "bank", name: "", bankName: "", accountNo: "", ifsc: "", upiId: "", openingBalance: 0, openingDate: "", float: 0, active: true, isDefault: false, ...initial });
  const set = <K extends keyof BankAccount>(k: K, v: BankAccount[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open onClose={onClose} title={initial?._id ? "Edit account" : "New account"} width="max-w-lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name *" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kotak current a/c" />
          <Select label="Kind" value={form.kind ?? "bank"} onChange={(e) => set("kind", e.target.value as AccountKind)} options={[{ value: "bank", label: "Bank" }, { value: "cash", label: "Cash box" }, { value: "upi", label: "UPI wallet" }]} />
        </div>
        {form.kind === "bank" && (
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bank" value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
            <Input label="Account no." value={form.accountNo ?? ""} onChange={(e) => set("accountNo", e.target.value)} />
            <Input label="IFSC" value={form.ifsc ?? ""} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} />
          </div>
        )}
        {form.kind === "upi" && <Input label="UPI ID" value={form.upiId ?? ""} onChange={(e) => set("upiId", e.target.value)} />}
        <Input label="Tally ledger" value={form.tallyLedger ?? ""} onChange={(e) => set("tallyLedger", e.target.value)} placeholder={form.kind === "cash" ? "Cash" : "e.g. Kotak Bank CA"} hint="The ledger name in Tally; blank uses the account's name" />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Opening balance" type="number" step="0.01" value={form.openingBalance ?? 0} onChange={(e) => set("openingBalance", Number(e.target.value))} />
          <Input label="As on" type="date" value={form.openingDate ? String(form.openingDate).slice(0, 10) : ""} onChange={(e) => set("openingDate", e.target.value || null)} />
          {form.kind === "cash" && <Input label="Float" type="number" step="1" value={form.float ?? 0} onChange={(e) => set("float", Number(e.target.value))} />}
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active !== false} onChange={(e) => set("active", e.target.checked)} /> Active</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} /> Default for vouchers</label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!String(form.name || "").trim()} loading={saveBankAccount.isPending}
            onClick={() => saveBankAccount.mutate({ id: initial?._id, body: { ...form, openingDate: form.openingDate || null } }, { onSuccess: () => { toast("Account saved", "success"); onClose(); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save", "error") })}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

function CategoryDialog({ initial, onClose }: { initial: Partial<ExpenseCategory> | null; onClose: () => void }) {
  const { toast } = useToast();
  const { saveCategory } = useAccountsMutations();
  const [form, setForm] = useState<Partial<ExpenseCategory>>({ name: "", ledger: "", itcEligible: false, approvalAbove: 0, tdsSection: "", active: true, ...initial });
  const set = <K extends keyof ExpenseCategory>(k: K, v: ExpenseCategory[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open onClose={onClose} title={initial?._id ? "Edit head" : "New expense head"} width="max-w-lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name *" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          <Input label="Tally ledger" value={form.ledger ?? ""} onChange={(e) => set("ledger", e.target.value)} />
          <Input label="Needs approval above ₹ (0 = always)" type="number" min={0} value={form.approvalAbove ?? 0} onChange={(e) => set("approvalAbove", Number(e.target.value))} />
          <Input label="Usual TDS section" value={form.tdsSection ?? ""} onChange={(e) => set("tdsSection", e.target.value)} placeholder="194C, 194I, 194J" />
          <Input label="Most one person may claim a day (₹)" type="number" min={0} value={form.claimDailyLimit ?? 0} onChange={(e) => set("claimDailyLimit", Number(e.target.value))} hint="0 = no limit" />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.itcEligible} onChange={(e) => set("itcEligible", e.target.checked)} /> GST on it can be claimed</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active !== false} onChange={(e) => set("active", e.target.checked)} /> Active</label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!String(form.name || "").trim()} loading={saveCategory.isPending}
            onClick={() => saveCategory.mutate({ id: initial?._id, body: form }, { onSuccess: () => { toast("Head saved", "success"); onClose(); }, onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save", "error") })}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

export function SettingsTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: accounts, isLoading } = useBankAccounts();
  const { data: categories } = useCategories();
  const [account, setAccount] = useState<Partial<BankAccount> | null | undefined>(undefined);
  const [category, setCategory] = useState<Partial<ExpenseCategory> | null | undefined>(undefined);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Cash &amp; bank accounts</h3>
          {isAdmin && <Button size="sm" variant="secondary" onClick={() => setAccount(null)}><Plus className="h-4 w-4" /> Account</Button>}
        </div>
        {isLoading ? <Skeleton className="mt-3 h-24 w-full" /> : (
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {(accounts ?? []).map((a) => (
              <li key={a._id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium">{a.name}</span> <span className="text-xs text-ink-400">{a.kind}{a.accountNo ? ` · ${a.accountNo}` : ""}{a.upiId ? ` · ${a.upiId}` : ""}</span>
                  {a.isDefault && <StatusChip tone="info" className="ml-2">default</StatusChip>}{a.active === false && <StatusChip tone="neutral" className="ml-2">inactive</StatusChip>}
                </span>
                <span className="flex items-center gap-2"><span className="tabular-nums">₹{money(a.balance)}</span>{isAdmin && <Button size="sm" variant="ghost" aria-label={`Edit ${a.name}`} onClick={() => setAccount(a)}><Pencil className="h-4 w-4" /></Button>}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Expense heads</h3>
          {isAdmin && <Button size="sm" variant="secondary" onClick={() => setCategory(null)}><Plus className="h-4 w-4" /> Head</Button>}
        </div>
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {(categories ?? []).map((c) => (
            <li key={c._id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="block text-xs text-ink-400">{c.approvalAbove ? `approval above ₹${money(c.approvalAbove)}` : "always approved by the office"}{c.itcEligible ? " · GST claimable" : ""}{c.tdsSection ? ` · TDS ${c.tdsSection}` : ""}{c.ledger ? ` · ${c.ledger}` : ""}</span>
              </span>
              <span className="flex items-center gap-2">{c.active === false && <StatusChip tone="neutral">inactive</StatusChip>}{isAdmin && <Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setCategory(c)}><Pencil className="h-4 w-4" /></Button>}</span>
            </li>
          ))}
        </ul>
      </Card>
      <BooksSettings isAdmin={isAdmin} />
      <AiAccuracy />
      {account !== undefined && <AccountDialog initial={account} onClose={() => setAccount(undefined)} />}
      {category !== undefined && <CategoryDialog initial={category} onClose={() => setCategory(undefined)} />}
    </div>
  );
}
