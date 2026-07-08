import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSupplierOptions, useMaterials } from "@/features/materials/hooks";
import { PoFormValues } from "./types";

const schema = z.object({
  supplier: z.string().min(1, "Select a supplier"),
  items: z
    .array(
      z.object({
        rawMaterial: z.string().min(1, "Select material"),
        quantity: z.coerce.number().positive("Qty > 0"),
        price: z.coerce.number().positive("Price > 0"),
      })
    )
    .min(1, "Add at least one item"),
});

export function PoForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: PoFormValues) => void;
  onCancel: () => void;
}) {
  const suppliers = useSupplierOptions();
  const materials = useMaterials({ search: "", category: "all", lowStock: false });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplier: "", items: [{ rawMaterial: "", quantity: 0, price: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = watch("items");
  const total = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0),
    0
  );

  const materialOptions = (materials.data ?? []).map((m) => ({
    value: m._id,
    label: `${m.name} (${m.category})`,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Select
        label="Supplier *"
        placeholder="Select supplier"
        options={(suppliers.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
        error={errors.supplier?.message}
        {...register("supplier")}
      />

      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">Items *</p>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_90px_100px_36px] gap-2 items-start">
              <Select
                placeholder="Material"
                options={materialOptions}
                error={errors.items?.[i]?.rawMaterial?.message}
                {...register(`items.${i}.rawMaterial`)}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Qty"
                error={errors.items?.[i]?.quantity?.message}
                {...register(`items.${i}.quantity`)}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Price ₹"
                error={errors.items?.[i]?.price?.message}
                {...register(`items.${i}.price`)}
              />
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(i)}
                className="h-10 grid place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                disabled={fields.length <= 1}
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {errors.items?.message && (
          <p className="mt-1 text-xs text-status-danger">{errors.items.message}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => append({ rawMaterial: "", quantity: 0, price: 0 })}
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>

      <p className="text-sm text-ink-600 text-right">
        Order total: <span className="font-bold tabular-nums">₹{total.toLocaleString()}</span>
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Create PO</Button>
      </div>
    </form>
  );
}
