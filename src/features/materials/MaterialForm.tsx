import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupplierOptions } from "./hooks";
import { useMaterialGroups } from "../materialGroups/hooks";
import { MaterialFormValues, RawMaterial } from "./types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  // The GROUP is what the form picks now, and `category` follows from
  // it on the server. Kept in the schema because a material that
  // predates groups carries a category and no link, and editing it
  // must not blank the one field every reader uses.
  group: z.string().min(1, "Group is required"),
  category: z.string().optional(),
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

  // A material filed under a category no group carries — which is every
  // material until the migration runs, and any created by an older
  // client after it — has nowhere to point. Rather than silently
  // reassigning it, its own category is offered as an option so saving
  // the form leaves it where it was.
  const groupOptions = [
    ...(groups.data ?? []).map((g) => ({ value: g._id, label: g.name })),
    ...(initial?.category &&
    !(groups.data ?? []).some((g) => g.name === initial.category)
      ? [{ value: `name:${initial.category}`, label: `${initial.category} (ungrouped)` }]
      : []),
  ];
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MaterialFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      group:
        initial?.group && typeof initial.group === "object"
          ? initial.group._id
          : (initial?.group as string) ??
            (initial?.category ? `name:${initial.category}` : ""),
      category: initial?.category ?? "",
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
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Group *"
          placeholder={groups.isLoading ? "Loading…" : "Select a group"}
          options={groupOptions}
          error={errors.group?.message}
          {...register("group")}
        />
        <Select
          label="Supplier"
          placeholder="Select supplier"
          options={(suppliers.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
          {...register("supplier")}
        />
      </div>
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
