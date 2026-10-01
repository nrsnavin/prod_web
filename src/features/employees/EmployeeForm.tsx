import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DEPARTMENTS, EmployeeFormValues, SkillProfile } from "./types";
import { SkillProfileFields } from "./SkillProfileFields";

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

type BasicValues = z.infer<typeof schema>;

const DAY_SHIFT_HOURS = 12;

export function EmployeeForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  aadhaarOnFile,
  canEditAadhaar = true,
}: {
  initial?: Partial<EmployeeFormValues>;
  submitting: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
  /**
   * Editing: the masked number on file ("XXXX XXXX 1234"), shown as the
   * field's placeholder. The real number never comes to the browser, so
   * the field starts empty and is sent only when someone types a new one.
   */
  aadhaarOnFile?: string | null;
  /** Only an admin may set an Aadhaar number; the server enforces it too. */
  canEditAadhaar?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BasicValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      department: initial?.department ?? "weaving",
      phoneNumber: initial?.phoneNumber ?? "",
      role: initial?.role ?? "",
      aadhar: "",
    },
  });

  // Salary is asked per DAY shift (12h) — what the floor talks in — and
  // stored as ₹/hour, which is what payroll computes from.
  const [shiftSalary, setShiftSalary] = useState(
    initial?.hourlyRate ? String(initial.hourlyRate * DAY_SHIFT_HOURS) : ""
  );
  const hourlyRate = shiftSalary === "" ? 0 : Number(shiftSalary) / DAY_SHIFT_HOURS;

  const [skillProfile, setSkillProfile] = useState<SkillProfile>(initial?.skillProfile ?? {});

  // An empty Aadhaar field means "keep what is on file": leave it out.
  const submit = ({ aadhar, ...basic }: BasicValues) =>
    onSubmit({ ...basic, ...(aadhar?.trim() ? { aadhar: aadhar.trim() } : {}), hourlyRate, skillProfile });

  const onFile = aadhaarOnFile && aadhaarOnFile !== "Not Provided" ? aadhaarOnFile : null;

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
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
        <Input
          label="Aadhaar"
          inputMode="numeric"
          autoComplete="off"
          placeholder={onFile ?? undefined}
          disabled={!canEditAadhaar}
          hint={
            !canEditAadhaar
              ? "Only an admin can change this"
              : onFile
                ? "Type a new number to replace it"
                : undefined
          }
          {...register("aadhar")}
        />
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <Input
          label="Shift salary — DAY 12h (₹)"
          type="number"
          min="0"
          value={shiftSalary}
          onChange={(e) => setShiftSalary(e.target.value)}
        />
        <p className="pb-2.5 text-xs text-ink-400">
          {hourlyRate > 0
            ? `= ₹${(Math.round(hourlyRate * 100) / 100).toLocaleString("en-IN")}/hour · NIGHT (12h) ₹${Math.round(hourlyRate * 12).toLocaleString("en-IN")}`
            : "Payroll pays per hour: DAY = 12h, NIGHT = 12h"}
        </p>
      </div>

      <div className="rounded-lg border border-ink-100 bg-canvas/50 p-4">
        <p className="mb-2 text-sm font-semibold">Skill &amp; performance questionnaire</p>
        <SkillProfileFields value={skillProfile} onChange={setSkillProfile} />
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
