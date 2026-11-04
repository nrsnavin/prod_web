import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useMachines } from "@/features/machines/hooks";
import type { CostCentreInput } from "./types";

type Kind = "" | "order" | "machine" | "department";
const kindOf = (v: CostCentreInput | undefined): Kind => (v?.orderNo !== undefined || v?.order ? "order" : v?.machine ? "machine" : v?.department !== undefined ? "department" : "");

/** Its own component, so the machines are fetched only when a machine is the centre. */
function MachinePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: machines } = useMachines("all");
  return <Select label="Machine" value={value} onChange={(e) => onChange(e.target.value)} options={(machines ?? []).map((m) => ({ value: m._id, label: `${m.ID} · ${m.manufacturer}` }))} placeholder="Pick the machine" />;
}

/**
 * Where a bill or expense is booked: the customer order it was bought
 * for (by its number), a machine, or a department. Optional; most
 * purchases carry none.
 */
export function CostCentreField({ value, onChange }: { value: CostCentreInput | undefined; onChange: (v: CostCentreInput | undefined) => void }) {
  const kind = kindOf(value);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select label="Cost centre" value={kind} onChange={(e) => { const k = e.target.value as Kind; onChange(k === "" ? undefined : k === "order" ? { orderNo: undefined } : k === "machine" ? { machine: "" } : { department: "" }); }}
        options={[{ value: "", label: "None" }, { value: "order", label: "A customer order" }, { value: "machine", label: "A machine" }, { value: "department", label: "A department" }]} />
      {kind === "order" && <Input label="Order number" type="number" min={1} value={value?.orderNo ?? ""} onChange={(e) => onChange({ orderNo: e.target.value === "" ? undefined : Number(e.target.value) })} hint="Shows on that order's P&L" />}
      {kind === "machine" && <MachinePicker value={value?.machine ?? ""} onChange={(id) => onChange({ machine: id })} />}
      {kind === "department" && <Input label="Department" value={value?.department ?? ""} onChange={(e) => onChange({ department: e.target.value })} placeholder="Office, canteen, security…" />}
    </div>
  );
}

/** The body the server takes: nothing when the centre is not filled in. */
export const costCentreBody = (v: CostCentreInput | undefined): CostCentreInput | undefined =>
  (v?.orderNo ? { orderNo: v.orderNo } : v?.machine ? { machine: v.machine } : v?.department?.trim() ? { department: v.department.trim() } : undefined);
