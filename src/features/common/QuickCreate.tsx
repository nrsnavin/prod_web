import { useState } from "react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import type { ComboOption } from "@/components/ui/Combobox";
import { useQuick } from "./quickCreateStore";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { useCustomerMutations } from "@/features/customers/hooks";
import { SupplierForm } from "@/features/suppliers/SupplierListPage";
import { useSupplierMutations } from "@/features/suppliers/hooks";
import { MaterialForm } from "@/features/materials/MaterialForm";
import { useMaterialMutations } from "@/features/materials/hooks";
import { ElasticForm } from "@/features/elastics/ElasticForm";
import { useElasticMutations } from "@/features/elastics/hooks";
import { EmployeeForm } from "@/features/employees/EmployeeForm";
import { useEmployeeMutations } from "@/features/employees/hooks";
import { AccountDialog } from "@/features/accounts/SettingsTab";
import { useAccountsMutations } from "@/features/accounts/hooks";

// ══════════════════════════════════════════════════════════════════
//  ADD IT HERE — the thing is not in the list
//
//  Any picker can offer "+ Add …": quickCreate(kind, typed) opens the
//  full form for that kind over the page, starting from what was typed,
//  and resolves with the new option (or null when closed). The picker
//  selects it; nobody leaves the order, bill or voucher they were in
//  the middle of. One host, mounted once, draws whichever form is asked.
// ══════════════════════════════════════════════════════════════════

const errorOf = (e: unknown) => (e instanceof ApiError ? e.message : "Could not save");

export function QuickCreateHost() {
  const ask = useQuick((s) => s.ask);
  const set = useQuick((s) => s.set);
  if (!ask) return null;
  const done = (o: ComboOption | null) => { ask.resolve(o); set(null); };
  const props = { name: ask.name, done };
  switch (ask.kind) {
    case "customer": return <NewCustomer {...props} />;
    case "supplier": return <NewSupplier {...props} />;
    case "material": return <NewMaterial {...props} />;
    case "elastic": return <NewElastic {...props} />;
    case "employee": return <NewEmployee {...props} />;
    case "expenseHead": return <NewExpenseHead {...props} />;
    case "bankAccount": return <AccountDialog initial={ask.name ? { name: ask.name } : null} onClose={() => done(null)} onSaved={(a) => done({ value: a._id, label: a.name })} />;
  }
}

type P = { name: string; done: (o: ComboOption | null) => void };

function NewCustomer({ name, done }: P) {
  const { toast } = useToast();
  const { create: m } = useCustomerMutations();
  return (
    <FormScreen open onClose={() => done(null)} title="New customer" width="max-w-3xl">
      <CustomerForm defaultName={name} submitting={m.isPending} onCancel={() => done(null)}
        onSubmit={(v) => m.mutate(v, { onSuccess: (c) => { toast(`${c.name} added`, "success"); done({ value: c._id, label: c.name }); }, onError: (e) => toast(errorOf(e), "error") })} />
    </FormScreen>
  );
}

function NewSupplier({ name, done }: P) {
  const { toast } = useToast();
  const { create: m } = useSupplierMutations();
  return (
    <FormScreen open onClose={() => done(null)} title="New supplier" width="max-w-3xl">
      <SupplierForm defaultName={name} submitting={m.isPending} onCancel={() => done(null)}
        onSubmit={(v) => m.mutate(v, { onSuccess: (s) => { toast(`${s.name} added`, "success"); done({ value: s._id, label: s.name }); }, onError: (e) => toast(errorOf(e), "error") })} />
    </FormScreen>
  );
}

function NewMaterial({ name, done }: P) {
  const { toast } = useToast();
  const { create: m } = useMaterialMutations();
  return (
    <FormScreen open onClose={() => done(null)} title="New material" width="max-w-2xl">
      <MaterialForm defaultName={name} submitting={m.isPending} onCancel={() => done(null)}
        onSubmit={(v) => m.mutate(v, { onSuccess: (r) => { toast(`${r.name} added`, "success"); done({ value: r._id, label: r.name }); }, onError: (e) => toast(errorOf(e), "error") })} />
    </FormScreen>
  );
}

function NewElastic({ name, done }: P) {
  const { toast } = useToast();
  const { create: m } = useElasticMutations();
  return (
    <FormScreen open onClose={() => done(null)} title="New elastic" width="max-w-4xl">
      <ElasticForm defaultName={name} submitting={m.isPending} onCancel={() => done(null)}
        onSubmit={(v) => m.mutate(v, { onSuccess: (el) => { toast(`${el.name} added`, "success"); done({ value: el._id, label: el.name }); }, onError: (e) => toast(errorOf(e), "error") })} />
    </FormScreen>
  );
}

function NewEmployee({ name, done }: P) {
  const { toast } = useToast();
  const { create: m } = useEmployeeMutations();
  return (
    <FormScreen open onClose={() => done(null)} title="New employee" width="max-w-3xl">
      <EmployeeForm initial={name ? { name } : undefined} submitting={m.isPending} onCancel={() => done(null)}
        onSubmit={(v) => m.mutate(v, { onSuccess: (e) => { toast(`${e.name} added`, "success"); done({ value: e._id, label: e.name }); }, onError: (e) => toast(errorOf(e), "error") })} />
    </FormScreen>
  );
}

/** An expense head: its name, the Tally ledger it posts to, and whether its GST is claimed. */
function NewExpenseHead({ name: start, done }: P) {
  const { toast } = useToast();
  const { saveCategory } = useAccountsMutations();
  const [name, setName] = useState(start);
  const [ledger, setLedger] = useState("");
  const [itc, setItc] = useState(true);
  return (
    <Modal open onClose={() => done(null)} title="New expense head" width="max-w-md">
      <div className="space-y-3">
        <Input label="Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Courier charges" autoFocus />
        <Input label="Tally ledger" value={ledger} onChange={(e) => setLedger(e.target.value)} placeholder="Blank: the same as the name" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itc} onChange={(e) => setItc(e.target.checked)} /> GST on these bills is claimed (input tax credit)</label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => done(null)}>Cancel</Button>
          <Button disabled={!name.trim()} loading={saveCategory.isPending} onClick={() => saveCategory.mutate(
            { body: { name: name.trim(), ledger: ledger.trim() || undefined, itcEligible: itc } },
            { onSuccess: (c) => { toast(`${c.name} added`, "success"); done({ value: c._id, label: c.name }); }, onError: (e) => toast(errorOf(e), "error") },
          )}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}
