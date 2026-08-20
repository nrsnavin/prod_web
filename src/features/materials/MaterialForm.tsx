import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupplierOptions, useMaterialCategories } from "./hooks";
import { useMaterialGroups } from "../materialGroups/hooks";
import { MaterialFormValues, RawMaterial } from "./types";

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
});

export function MaterialForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: RawMaterial;
  submitting: boolean;
  onSubmit: (values: MaterialFormValues) => void;
  onCancel: () => void;
}) {
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
    initial?.category &&
    !(categories.data?.categories ?? []).includes(initial.category)
      ? [{ value: initial.category, label: `${initial.category} — not a category` }]
      : [];

  const groupOptions = [
    { value: "", label: "— None —" },
    ...(groups.data ?? []).map((g) => ({ value: g._id, label: g.name })),
  ];
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MaterialFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      category: initial?.category ?? "",
      group:
        initial?.group && typeof initial.group === "object"
          ? initial.group._id
          : ((initial?.group as string) ?? ""),
      unit: initial?.unit ?? "kg",
      supplier:
        initial?.supplier && typeof initial.supplier === "object"
          ? initial.supplier._id
          : (initial?.supplier as string) ?? "",
      stock: initial?.stock ?? 0,
      minStock: initial?.minStock ?? 0,
      price: initial?.price ?? 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Material name *" error={errors.name?.message} {...register("name")} />
      <div className="grid gap-3 sm:grid-cols-2">
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
        <Input
          label={initial ? "Stock" : "Opening stock"}
          type="number"
          step="0.01"
          {...register("stock")}
        />
        <Input label="Min stock" type="number" step="0.01" {...register("minStock")} />
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
