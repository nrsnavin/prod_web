import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupplierOptions } from "./hooks";
import { MATERIAL_CATEGORIES, MaterialFormValues, RawMaterial } from "./types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MaterialFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      category: initial?.category ?? "warp",
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
          label="Category *"
          options={MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c }))}
          error={errors.category?.message}
          {...register("category")}
        />
        <Select
          label="Supplier"
          placeholder="Select supplier"
          options={(suppliers.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
          {...register("supplier")}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Price (₹)" type="number" step="0.01" {...register("price")} />
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
