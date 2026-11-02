import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Customer, CustomerFormValues } from "./types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  contactName: z.string().optional(),
  phoneNumber: z
    .string()
    .regex(/^\d{10}$/, "Enter a 10-digit phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  gstin: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter a 6-digit PIN code")
    .optional()
    .or(z.literal("")),
  stateCode: z
    .string()
    .regex(/^\d{2}$/, "Enter the 2-digit GST state code")
    .optional()
    .or(z.literal("")),
  paymentTerms: z.string().optional(),
  // 0 = no limit: nothing is held until the office sets one.
  creditLimit: z.coerce.number().min(0, "0 or more").optional(),
  maxOverdueDays: z.coerce.number().min(0, "0 or more").optional(),
});

export function CustomerForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Customer;
  submitting: boolean;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      contactName: initial?.contactName ?? "",
      phoneNumber: initial?.phoneNumber ?? "",
      email: initial?.email ?? "",
      gstin: initial?.gstin ?? "",
      address: initial?.address ?? "",
      city: initial?.city ?? "",
      pincode: initial?.pincode ?? "",
      stateCode: initial?.stateCode ?? "",
      paymentTerms: initial?.paymentTerms ?? "",
      creditLimit: initial?.creditLimit ?? 0,
      maxOverdueDays: initial?.maxOverdueDays ?? 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Company name *" error={errors.name?.message} {...register("name")} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Contact person" {...register("contactName")} />
        <Input
          label="Phone"
          inputMode="numeric"
          error={errors.phoneNumber?.message}
          {...register("phoneNumber")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Input label="GSTIN" {...register("gstin")} />
      </div>
      <Input label="Billing address" placeholder="Street, area" {...register("address")} />
      <div className="grid grid-cols-3 gap-3">
        <Input label="City" {...register("city")} />
        <Input label="PIN code" inputMode="numeric" error={errors.pincode?.message} {...register("pincode")} />
        <Input
          label="GST state code"
          inputMode="numeric"
          placeholder="from GSTIN"
          error={errors.stateCode?.message}
          {...register("stateCode")}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Payment terms" placeholder="e.g. 30 days" {...register("paymentTerms")} />
        <Input label="Credit limit (₹)" type="number" min={0} hint="0 = no limit" error={errors.creditLimit?.message} {...register("creditLimit")} />
        <Input label="Hold when overdue beyond (days)" type="number" min={0} hint="0 = never" error={errors.maxOverdueDays?.message} {...register("maxOverdueDays")} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
