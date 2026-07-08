import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useEmployeesByDept, usePackingJobs } from "./hooks";
import { PackingFormValues } from "./types";

const schema = z.object({
  job: z.string().min(1, "Select job"),
  elastic: z.string().min(1, "Select elastic"),
  meter: z.coerce.number().positive("Meters > 0"),
  netWeight: z.coerce.number().min(0),
  tareWeight: z.coerce.number().min(0),
  grossWeight: z.coerce.number().min(0),
  checkedBy: z.string().min(1, "Select checker"),
  packedBy: z.string().min(1, "Select packer"),
  joints: z.coerce.number().min(0).optional(),
  stretch: z.string().optional(),
  size: z.string().optional(),
});

export function PackingForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: PackingFormValues) => void;
  onCancel: () => void;
}) {
  const jobs = usePackingJobs();
  const checkers = useEmployeesByDept("checking");
  const packers = useEmployeesByDept("packing");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PackingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { job: "", elastic: "", meter: 0, netWeight: 0, tareWeight: 0, grossWeight: 0, checkedBy: "", packedBy: "" },
  });

  const jobId = watch("job");
  const selectedJob = (jobs.data ?? []).find((j) => j._id === jobId);
  const elasticOptions = (selectedJob?.elastics ?? [])
    .map((l) => (typeof l.elastic === "object" && l.elastic ? l.elastic : null))
    .filter((e): e is { _id: string; name: string } => !!e)
    .map((e) => ({ value: e._id, label: e.name }));

  const empOptions = (list?: Array<{ _id: string; name: string }>) =>
    (list ?? []).map((e) => ({ value: e._id, label: e.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Job (in packing) *"
          placeholder={jobs.isLoading ? "Loading…" : "Select job"}
          options={(jobs.data ?? []).map((j) => ({
            value: j._id,
            label: `J-${j.jobOrderNo}${j.customer?.name ? ` — ${j.customer.name}` : ""}`,
          }))}
          error={errors.job?.message}
          {...register("job")}
        />
        <Select
          label="Elastic *"
          placeholder="Select elastic"
          options={elasticOptions}
          error={errors.elastic?.message}
          {...register("elastic")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Meters *" type="number" step="0.01" error={errors.meter?.message} {...register("meter")} />
        <Input label="Joints" type="number" {...register("joints")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Net wt (kg) *" type="number" step="0.01" {...register("netWeight")} />
        <Input label="Tare wt (kg) *" type="number" step="0.01" {...register("tareWeight")} />
        <Input label="Gross wt (kg) *" type="number" step="0.01" {...register("grossWeight")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Stretch" {...register("stretch")} />
        <Input label="Size" {...register("size")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Checked by *"
          placeholder="Select"
          options={empOptions(checkers.data)}
          error={errors.checkedBy?.message}
          {...register("checkedBy")}
        />
        <Select
          label="Packed by *"
          placeholder="Select"
          options={empOptions(packers.data)}
          error={errors.packedBy?.message}
          {...register("packedBy")}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Add packing</Button>
      </div>
    </form>
  );
}
