import { useCallback, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { customerService } from "@/features/customers/api";
import { elasticService } from "@/features/elastics/api";
import { ElasticGroup, ElasticGroupFormValues, itemElasticId, itemElasticName } from "./types";

const schema = z.object({
  name: z.string().min(1, "Group name required"),
  customer: z.string().optional(),
  items: z
    .array(
      z.object({
        elastic: z.string().min(1, "Select elastic"),
        defaultQuantity: z.coerce.number().min(0, "Qty ≥ 0"),
      })
    )
    .min(1, "Add at least one elastic"),
});

export function ElasticGroupForm({
  initial,
  fixedCustomerId,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: ElasticGroup;
  fixedCustomerId?: string;
  submitting: boolean;
  onSubmit: (v: ElasticGroupFormValues) => void;
  onCancel: () => void;
}) {
  const loadCustomers = useCallback(
    (q: string) =>
      customerService.list({ page: 1, search: q, limit: 50 }).then((r) => {
        const opts = r.customers.map((c) => ({ value: c._id, label: c.name }));
        // Keep "Global" reachable when not narrowing by a name.
        return q.trim() ? opts : [{ value: "", label: "Global (any customer)" }, ...opts];
      }),
    []
  );
  const loadElastics = useCallback(
    (q: string) =>
      elasticService
        .list({ page: 1, search: q, limit: 50 })
        .then((r) => r.elastics.map((e) => ({ value: e._id, label: e.name }))),
    []
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ElasticGroupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      customer: fixedCustomerId ?? initial?.customer?._id ?? "",
      items:
        initial?.items?.map((it) => ({ elastic: itemElasticId(it), defaultQuantity: it.defaultQuantity })) ??
        [{ elastic: "", defaultQuantity: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Labels for elastics already on the group (edit mode) so their lines
  // render a name before any search runs.
  const elasticSeed = useMemo(
    () =>
      (initial?.items ?? []).map((it) => ({ value: itemElasticId(it), label: itemElasticName(it) })),
    [initial]
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Group name *" placeholder="e.g. Page Apparels — standing waistbands" error={errors.name?.message} {...register("name")} />
        {!fixedCustomerId && (
          <Controller
            control={control}
            name="customer"
            render={({ field }) => (
              <AsyncCombobox
                label="Customer"
                placeholder="Global (any customer)"
                loadOptions={loadCustomers}
                seedOptions={[{ value: "", label: "Global (any customer)" }]}
                value={field.value ?? ""}
                onChange={field.onChange}
              />
            )}
          />
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-600">Elastics *</p>
        <div className="hidden grid-cols-[1fr_120px_36px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
          <span>Elastic</span>
          <span className="text-right">Default qty (m)</span>
          <span />
        </div>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_120px_36px] gap-2 items-start">
              <Controller
                control={control}
                name={`items.${i}.elastic`}
                render={({ field }) => (
                  <AsyncCombobox
                    placeholder="Select elastic"
                    loadOptions={loadElastics}
                    seedOptions={elasticSeed}
                    error={errors.items?.[i]?.elastic?.message}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="0 = blank"
                error={errors.items?.[i]?.defaultQuantity?.message}
                {...register(`items.${i}.defaultQuantity`)}
              />
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(i)}
                className="h-10 grid place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40"
                disabled={fields.length <= 1}
                aria-label="Remove elastic"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        {errors.items?.message && <p className="mt-1 text-xs text-status-danger">{errors.items.message}</p>}
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => append({ elastic: "", defaultQuantity: 0 })}>
          <Plus className="h-4 w-4" /> Add elastic
        </Button>
      </div>

      <p className="text-xs text-ink-400">
        Default quantities prefill the order/DC line when the group is added. Leave 0 to fill in each time.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>{initial ? "Save group" : "Create group"}</Button>
      </div>
    </form>
  );
}
