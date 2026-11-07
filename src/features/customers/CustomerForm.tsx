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
  tallyName: z.string().max(120).optional(),
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
  tan: z.string().regex(/^([A-Z]{4}\d{5}[A-Z])?$/i, "A TAN is 4 letters, 5 digits, 1 letter").optional().or(z.literal("")),
  pan: z.string().regex(/^([A-Z]{5}\d{4}[A-Z])?$/i, "A PAN is 5 letters, 4 digits, 1 letter").optional().or(z.literal("")),
  // Blank: the rate in accounts settings applies.
  interestRate: z.union([z.literal(""), z.coerce.number().min(0, "0 or more").max(100, "At most 100")]).optional(),
  interestGraceDays: z.union([z.literal(""), z.coerce.number().min(0, "0 or more").max(365, "At most 365")]).optional(),
  country: z.string().max(60).optional(),
  sez: z.boolean().optional(),
  currency: z.string().regex(/^([A-Z]{3})?$/i, "Three letters: USD, EUR, GBP").optional().or(z.literal("")),
});

export function CustomerForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  defaultName,
}: {
  initial?: Customer;
  submitting: boolean;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
  /** A new one, started from a name typed in a picker. */
  defaultName?: string;
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
      name: initial?.name ?? defaultName ?? "",
      tallyName: initial?.tallyName ?? "",
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
      tan: initial?.tan ?? "",
      pan: initial?.pan ?? "",
      interestRate: initial?.interestRate ?? "",
      interestGraceDays: initial?.interestGraceDays ?? "",
      country: initial?.country ?? "",
      sez: initial?.sez ?? false,
      currency: initial?.currency ?? "",
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
      <Input label="Name in Tally (if different)" placeholder="Exactly as the ledger is named in Tally" hint="Every voucher sent to Tally goes to this ledger, so renaming here never opens a second one there." {...register("tallyName")} />
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
      <div className="grid grid-cols-2 gap-3">
        <Input label="TAN" placeholder="CHEC12345A" hint="Matches the TDS they deduct to Form 26AS" error={errors.tan?.message} {...register("tan")} />
        <Input label="PAN" placeholder="AAAPC1234F" error={errors.pan?.message} {...register("pan")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Interest on overdue (% a year)" type="number" min={0} max={100} step="0.5" hint="Blank: the rate in accounts settings" error={errors.interestRate?.message} {...register("interestRate")} />
        <Input label="Grace days before interest" type="number" min={0} max={365} hint="Blank: as in settings" error={errors.interestGraceDays?.message} {...register("interestGraceDays")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Country" placeholder="India" hint="Abroad: invoices go as exports" {...register("country")} />
        <Input label="Invoice currency" placeholder="INR" hint="USD, EUR… for an export customer" error={errors.currency?.message} {...register("currency")} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" {...register("sez")} /> SEZ unit (zero-rated)</label>
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
