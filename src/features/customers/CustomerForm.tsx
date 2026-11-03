import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Customer, CustomerFormValues } from "./types";
import { CardFillButton, GstinHint, SimilarParties, type SimilarParty } from "@/features/parties/PartyCardFill";
import { gstinInfo } from "@/features/parties/gstin";

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
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [seedSimilar, setSeedSimilar] = useState<SimilarParty[]>([]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
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

  const [name, gstin, phone] = watch(["name", "gstin", "phoneNumber"]);
  // A GSTIN typed or read fills the state code when it is empty.
  const gstinField = register("gstin");
  const onGstin = (v: string) => {
    const i = gstinInfo(v);
    if (i.valid && !getValues("stateCode")) setValue("stateCode", i.stateCode);
  };
  return (
    <form onSubmit={handleSubmit((v) => onSubmit({ ...v, ...(aiSuggestion && !initial ? { aiSuggestion } : {}) }))} className="space-y-4" noValidate>
      {!initial && (
        <CardFillButton kind="customer" onFill={(f, ai, similar) => {
          const opt = { shouldDirty: true };
          if (f.name) setValue("name", f.name, opt);
          if (f.contactName) setValue("contactName", f.contactName, opt);
          if (f.phone) setValue("phoneNumber", f.phone, opt);
          if (f.email) setValue("email", f.email, opt);
          if (f.gstin) setValue("gstin", f.gstin, opt);
          if (f.address) setValue("address", f.address, opt);
          if (f.city) setValue("city", f.city, opt);
          if (f.pincode) setValue("pincode", f.pincode, opt);
          if (f.stateCode) setValue("stateCode", f.stateCode, opt);
          setAiSuggestion(ai); setSeedSimilar(similar);
        }} />
      )}
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
        <div>
          <Input label="GSTIN" {...gstinField} onChange={(e) => { gstinField.onChange(e); onGstin(e.target.value); }} />
          <GstinHint gstin={gstin ?? ""} />
        </div>
      </div>
      <SimilarParties kind="customer" name={name ?? ""} gstin={gstin ?? ""} phone={phone ?? ""} excludeId={initial?._id} seed={seedSimilar} />
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
