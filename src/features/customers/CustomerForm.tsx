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
  paymentTerms: z.string().optional(),
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
      paymentTerms: initial?.paymentTerms ?? "",
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
      <Input label="Payment terms" placeholder="e.g. 30 days" {...register("paymentTerms")} />
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
