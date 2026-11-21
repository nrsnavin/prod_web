import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formResolver } from "@/core/forms/formResolver";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupplierOptions, useMaterialCategories } from "./hooks";
import { useMaterialGroups } from "../materialGroups/hooks";
import { MaterialFormValues, RawMaterial } from "./types";
import { SimilarMaterials } from "./SimilarMaterials";

// ══════════════════════════════════════════════════════════════════
//  TWO CLASSIFICATIONS, TWO PICKERS
//
//  This form used to ask for a GROUP and let the server derive the
//  category from it. That made a group called "Trim Tape" able to set
//  a yarn's category to "Trim Tape" — a value the elastic recipe
//  picker and the MRP sheet cannot read — and quietly drop that yarn
//  out of the warp picker.
//
//  Category is now required and comes from a fixed list the server
//  serves. Group is optional and is the mill's own. Neither derives
//  from the other, so both are asked for.
// ══════════════════════════════════════════════════════════════════

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  // Required, because the engine reads it and there is no sensible
  // default: warp and Chemicals are not interchangeable.
  category: z.string().min(1, "Category is required"),
  // Optional, because a material does not have to be filed anywhere.
  group: z.string().optional(),
  unit: z.string().optional(),
  supplier: z.string().optional(),
  stock: z.coerce.number().min(0).optional(),
  minStock: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).optional(),
  // What a purchase order line for this material takes unless it says
  // otherwise. The same rules as the elastic's tax fields and the server
  // (prod/services/purchaseTax.js).
  hsn: z.string().trim().regex(/^(\d{4,8})?$/, "HSN is 4 to 8 digits").optional(),
  // Blank means "the Settings default"; sent as null so an edit clears it.
  gstPercent: z
    .union([z.literal(""), z.null(), z.coerce.number().min(0, "GST % is 0 to 100").max(100, "GST % is 0 to 100")])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
});

export function MaterialForm({
  initial,
  cloneFrom,
  submitting,
  onSubmit,
  onCancel,
  defaultName,
}: {
  /** Editing this material. */
  initial?: RawMaterial;
  /**
   * Creating a new material from this one's specification: category,
   * group, supplier, unit, price, min stock. Never its name (the person
   * cloning names it; a required blank field stops an unnamed copy) and
   * never its stock, which belongs to the material that received it — a
   * copied figure would be stock no ledger accounts for.
   */
  cloneFrom?: RawMaterial;
  submitting: boolean;
  onSubmit: (values: MaterialFormValues) => void;
  onCancel: () => void;
  /** A new one, started from a name typed in a picker. */
  defaultName?: string;
}) {
  const source = initial ?? cloneFrom;
  const suppliers = useSupplierOptions();
  const groups = useMaterialGroups();
  const categories = useMaterialCategories();

  const categoryOptions = (categories.data?.categories ?? []).map((c) => ({
    value: c,
    label: c,
  }));

  // A material written before the two were separated may hold a group
  // name in `category`. It is offered as an extra option, labelled, so
  // opening such a material does not present an empty required field —
  // but it reads as wrong, which is the point: saving the form is the
  // moment it gets corrected.
  const legacyCategory =
    source?.category &&
    !(categories.data?.categories ?? []).includes(source.category)
      ? [{ value: source.category, label: `${source.category} — not a category` }]
      : [];

  const groupOptions = [
    { value: "", label: "— None —" },
    ...(groups.data ?? []).map((g) => ({ value: g._id, label: g.name })),
  ];
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<MaterialFormValues>({
    // The tax rate goes in as typed text and comes out a number or null
    // (blank: the default), as on the elastic form.
    resolver: formResolver<MaterialFormValues>(schema as unknown as z.ZodType<MaterialFormValues>),
    defaultValues: {
      name: initial?.name ?? defaultName ?? "",
      category: source?.category ?? "",
      group:
        source?.group && typeof source.group === "object"
          ? source.group._id
          : ((source?.group as string) ?? ""),
      unit: source?.unit ?? "kg",
      supplier:
        source?.supplier && typeof source.supplier === "object"
          ? source.supplier._id
          : (source?.supplier as string) ?? "",
      stock: initial?.stock ?? 0,
      minStock: source?.minStock ?? 0,
      price: source?.price ?? 0,
      // A copy is the same goods, taxed the same way.
      hsn: source?.hsn ?? "",
      gstPercent: source?.gstPercent ?? "",
    },
  });

  return (
    <form
      // An edit sends no stock figure. The form used to send the one it
      // loaded with every save — which put back whatever had been drawn
      // since it was opened, and let a typed figure change the stock with
      // no ledger row, reason or name. Stock is changed with Adjust stock.
      onSubmit={handleSubmit((values) => {
        if (!initial) return onSubmit(values);
        const fields = { ...values };
        delete fields.stock;
        onSubmit(fields);
      })}
      className="space-y-4"
      noValidate
    >
      <Input
        label="Material name *"
        error={errors.name?.message}
        placeholder={cloneFrom ? `e.g. ${cloneFrom.name} (new shade)` : undefined}
        autoFocus={!!cloneFrom}
        {...register("name")}
      />
      <SimilarMaterials name={watch("name")} category={watch("category")} exclude={initial?._id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Select
            label="Category *"
            placeholder={categories.isLoading ? "Loading…" : "Select a category"}
            options={[...categoryOptions, ...legacyCategory]}
            error={errors.category?.message}
            {...register("category")}
          />
          <p className="mt-1 text-xs text-ink-400">
            What the system needs to know. Fixed list.
          </p>
        </div>
        <div>
          <Select
            label="Group"
            placeholder={groups.isLoading ? "Loading…" : "None"}
            options={groupOptions}
            error={errors.group?.message}
            {...register("group")}
          />
          <p className="mt-1 text-xs text-ink-400">
            Your own classification. Optional —{" "}
            <Link to="/materials/groups" className="underline hover:text-ink-900">
              manage groups
            </Link>
            .
          </p>
        </div>
      </div>
      <Select
        label="Supplier"
        placeholder="Select supplier"
        options={(suppliers.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
        {...register("supplier")}
      />
      <div className="grid grid-cols-4 gap-3">
        <Input label="Price (₹)" type="number" step="0.01" {...register("price")} />
        {/*
          The server read `m.unit || ""` for years before this field
          existed, so every unit it returned was blank. Blank now means
          "take the group's default", which is kg unless the group says
          otherwise.
        */}
        <Input label="Unit" placeholder="kg" {...register("unit")} />
        {initial ? (
          // Shown, not taken: see the note on the form's submit.
          <Input
            label="Stock"
            value={`${(initial.stock ?? 0).toLocaleString("en-IN")} ${initial.unit || "kg"}`}
            disabled
            readOnly
            hint="Changed with Adjust stock, which records who and why."
          />
        ) : (
          <Input label="Opening stock" type="number" step="0.01" {...register("stock")} />
        )}
        <Input label="Min stock" type="number" step="0.01" {...register("minStock")} />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-600">GST on buying it</p>
        <p className="text-xs text-ink-400">
          What a purchase order line takes unless the line says otherwise. Leave the rate blank
          to use the default in Settings → Invoice.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Input label="HSN" inputMode="numeric" placeholder="e.g. 5402" error={errors.hsn?.message} {...register("hsn")} />
          <Input label="GST %" type="number" step="0.01" placeholder="default" error={errors.gstPercent?.message} {...register("gstPercent")} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Add material"}
        </Button>
      </div>
    </form>
  );
}
