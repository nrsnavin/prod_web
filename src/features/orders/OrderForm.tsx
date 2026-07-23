import { useCallback, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { customerService } from "@/features/customers/api";
import { elasticService } from "@/features/elastics/api";
import { useElasticGroups } from "@/features/elasticGroups/hooks";
import { itemElasticId, itemElasticName } from "@/features/elasticGroups/types";
import { OrderFormValues } from "./types";
import { OrderEtaPanel } from "./OrderEtaPanel";

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
  // Server-searched dropdowns: type to query the full masters, not just a
  // preloaded page (customer/elastic lists can exceed the API's page cap).
  const loadCustomers = useCallback(
    (q: string) =>
      customerService
        .list({ page: 1, search: q, limit: 50 })
        .then((r) => r.customers.map((c) => ({ value: c._id, label: c.name }))),
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
    watch,
    getValues,
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
  const { fields, append, remove, replace } = useFieldArray({ control, name: "elasticOrdered" });

  const watchedLines = watch("elasticOrdered");
  const watchedSupply = watch("supplyDate");
  const watchedCustomer = watch("customer");

  // Groups for the selected customer (plus global bundles).
  const groups = useElasticGroups(watchedCustomer || undefined, !!watchedCustomer);
  const [groupPick, setGroupPick] = useState("");

  const addGroup = (groupId: string) => {
    const g = groups.data?.find((x) => x._id === groupId);
    if (!g) return;
    const current = getValues("elasticOrdered") ?? [];
    const existing = new Set(current.map((l) => l.elastic).filter(Boolean));
    const toAdd = g.items
      .map((it) => ({ elastic: itemElasticId(it), quantity: it.defaultQuantity || 0 }))
      .filter((l) => l.elastic && !existing.has(l.elastic));
    if (toAdd.length === 0) return;
    const onlyEmptyRow = current.length === 1 && !current[0].elastic && !Number(current[0].quantity);
    if (onlyEmptyRow) replace(toAdd);
    else toAdd.forEach((l) => append(l));
  };

  // Labels for elastics pulled in via a group, so those lines show a name
  // even though they were never searched for individually.
  const elasticSeed = useMemo(
    () =>
      (groups.data ?? []).flatMap((g) =>
        g.items.map((it) => ({ value: itemElasticId(it), label: itemElasticName(it) }))
      ),
    [groups.data]
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="customer"
          render={({ field }) => (
            <AsyncCombobox
              label="Customer *"
              placeholder="Select customer"
              loadOptions={loadCustomers}
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

      {/* Add from an elastic group — always shown so the shortcut is
          discoverable; the body adapts to whether a customer/groups exist. */}
      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-600">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">Add from elastic group</p>
            <p className="text-xs text-ink-400">
              Pick a saved bundle to add all its elastics to the order at once.
            </p>
          </div>
        </div>
        <div className="mt-3">
          {!watchedCustomer ? (
            <p className="text-xs text-ink-400">Select a customer to load its saved groups.</p>
          ) : groups.isLoading ? (
            <p className="text-xs text-ink-400">Loading groups…</p>
          ) : (groups.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-ink-400">
              No saved groups for this customer yet. Create one under Elastic Groups.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-72">
                <Combobox
                  placeholder="Select a group…"
                  options={(groups.data ?? []).map((g) => ({
                    value: g._id,
                    label: `${g.name}${g.customer ? "" : " · Global"} (${g.items.length})`,
                  }))}
                  value={groupPick}
                  onChange={(v) => {
                    addGroup(v);
                    setGroupPick("");
                  }}
                />
              </div>
              <span className="text-xs text-ink-400">adds all its elastics to the order</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">Elastics ordered *</p>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_110px_36px] gap-2 items-start">
              <Controller
                control={control}
                name={`elasticOrdered.${i}.elastic`}
                render={({ field }) => (
                  <AsyncCombobox
                    placeholder="Select elastic"
                    loadOptions={loadElastics}
                    seedOptions={elasticSeed}
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

      <OrderEtaPanel lines={watchedLines ?? []} supplyDate={watchedSupply} />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Create order</Button>
      </div>
    </form>
  );
}
