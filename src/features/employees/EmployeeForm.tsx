import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DEPARTMENTS, EmployeeFormValues } from "./types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  department: z.string().min(1, "Department is required"),
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, "Enter a 10-digit phone number")
    .optional()
    .or(z.literal("")),
  role: z.string().optional(),
  aadhar: z.string().optional(),
});

export function EmployeeForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<EmployeeFormValues>;
  submitting: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      department: initial?.department ?? "weaving",
      phoneNumber: initial?.phoneNumber ?? "",
      role: initial?.role ?? "",
      aadhar: initial?.aadhar ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Full name *" error={errors.name?.message} {...register("name")} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Department *"
          options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          error={errors.department?.message}
          {...register("department")}
        />
        <Input label="Role" placeholder="e.g. operator" {...register("role")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Phone"
          inputMode="numeric"
          error={errors.phoneNumber?.message}
          {...register("phoneNumber")}
        />
        <Input label="Aadhar" inputMode="numeric" {...register("aadhar")} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial?.name ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}
