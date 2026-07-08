import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useRunningMachines, useWeavingEmployees } from "./hooks";
import { ShiftPlanFormValues } from "./types";

const schema = z.object({
  date: z.string().min(1, "Date required"),
  shiftType: z.enum(["DAY", "NIGHT"]),
  description: z.string().optional(),
  machines: z
    .array(
      z.object({
        machine: z.string().min(1, "Machine required"),
        operator: z.string().min(1, "Operator required"),
        jobOrderNo: z.coerce.number(),
      })
    )
    .min(1, "Assign at least one machine"),
});

export function ShiftPlanForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: ShiftPlanFormValues) => void;
  onCancel: () => void;
}) {
  const machines = useRunningMachines();
  const operators = useWeavingEmployees();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ShiftPlanFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      shiftType: "DAY",
      description: "",
      machines: [{ machine: "", operator: "", jobOrderNo: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "machines" });

  const machineOptions = (machines.data ?? []).map((m) => ({
    value: m.machineId,
    label: `${m.ID}${m.jobOrderNo ? ` · J-${m.jobOrderNo}` : ""}`,
  }));
  const operatorOptions = (operators.data ?? []).map((e) => ({ value: e._id, label: e.name }));

  // Machine choice determines the job order running on it.
  const onMachinePick = (index: number, machineId: string) => {
    const m = (machines.data ?? []).find((x) => x.machineId === machineId);
    setValue(`machines.${index}.machine`, machineId);
    setValue(`machines.${index}.jobOrderNo`, Number(m?.jobOrderNo) || 0);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Date *" type="date" error={errors.date?.message} {...register("date")} />
        <Select
          label="Shift *"
          options={[
            { value: "DAY", label: "Day" },
            { value: "NIGHT", label: "Night" },
          ]}
          {...register("shiftType")}
        />
      </div>
      <Input label="Description" {...register("description")} />

      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">
          Machine assignments * (running machines carry their job)
        </p>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_36px] gap-2 items-start">
              <Select
                placeholder="Machine"
                options={machineOptions}
                error={errors.machines?.[i]?.machine?.message}
                {...register(`machines.${i}.machine`, {
                  onChange: (e) => onMachinePick(i, e.target.value),
                })}
              />
              <Select
                placeholder="Operator"
                options={operatorOptions}
                error={errors.machines?.[i]?.operator?.message}
                {...register(`machines.${i}.operator`)}
              />
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(i)}
                className="h-10 grid place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                disabled={fields.length <= 1}
                aria-label="Remove assignment"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => append({ machine: "", operator: "", jobOrderNo: 0 })}
        >
          <Plus className="h-4 w-4" /> Add machine
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Create shift plan</Button>
      </div>
    </form>
  );
}
