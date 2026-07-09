import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { useCustomers } from "@/features/customers/hooks";
import { useElastics } from "@/features/elastics/hooks";
import { OrderFormValues } from "./types";

const schema = z.object({
  date: z.string().min(1, "Order date required"),
  po: z.string().min(1, "Customer PO reference required"),
  customer: z.string().min(1, "Select a customer"),
  supplyDate: z.string().min(1, "Supply date required"),
  description: z.string().optional(),
  elasticOrdered: z
    .array(
      z.object({
        elastic: z.string().min(1, "Select elastic"),
        quantity: z.coerce.number().positive("Qty > 0"),
      })
    )
    .min(1, "Add at least one elastic"),
});

export function OrderForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: OrderFormValues) => void;
  onCancel: () => void;
}) {
  // Big page sizes keep these dropdowns complete without a picker UI.
  const customers = useCustomers({ page: 1, search: "" });
  const elastics = useElastics({ page: 1, search: "" });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      po: "",
      customer: "",
      supplyDate: "",
      description: "",
      elasticOrdered: [{ elastic: "", quantity: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "elasticOrdered" });

  const elasticOptions = (elastics.data?.elastics ?? []).map((e) => ({
    value: e._id,
    label: e.name,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="customer"
          render={({ field }) => (
            <Combobox
              label="Customer *"
              placeholder="Select customer"
              options={(customers.data?.customers ?? []).map((c) => ({ value: c._id, label: c.name }))}
              error={errors.customer?.message}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Input label="Customer PO ref *" error={errors.po?.message} {...register("po")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Order date *" type="date" error={errors.date?.message} {...register("date")} />
        <Input label="Supply date *" type="date" error={errors.supplyDate?.message} {...register("supplyDate")} />
      </div>
      <Input label="Description" {...register("description")} />

      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">Elastics ordered *</p>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_110px_36px] gap-2 items-start">
              <Controller
                control={control}
                name={`elasticOrdered.${i}.elastic`}
                render={({ field }) => (
                  <Combobox
                    placeholder="Select elastic"
                    options={elasticOptions}
                    error={errors.elasticOrdered?.[i]?.elastic?.message}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Qty (m)"
                error={errors.elasticOrdered?.[i]?.quantity?.message}
                {...register(`elasticOrdered.${i}.quantity`)}
              />
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(i)}
                className="h-10 grid place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                disabled={fields.length <= 1}
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {errors.elasticOrdered?.message && (
          <p className="mt-1 text-xs text-status-danger">{errors.elasticOrdered.message}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => append({ elastic: "", quantity: 0 })}
        >
          <Plus className="h-4 w-4" /> Add elastic
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Create order</Button>
      </div>
    </form>
  );
}
