import { useCallback, useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { elasticService } from "@/features/elastics/api";
import { useOrders } from "@/features/orders/hooks";
import { DcFormValues } from "./types";
import { useDcOrderInfo } from "./hooks";

const schema = z.object({
  type: z.enum(["elastic", "machine_part"]),
  orderId: z.string().optional(),
  orderNo: z.coerce.number().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().optional(),
  customerGstin: z.string().optional(),
  customerAddress: z.string().optional(),
  dispatchDate: z.string().optional(),
  vehicleNo: z.string().optional(),
  driverName: z.string().optional(),
  transporter: z.string().optional(),
  lrNumber: z.string().optional(),
  remarks: z.string().optional(),
  items: z
    .array(
      z.object({
        elastic: z.string().optional(),
        elasticName: z.string().optional(),
        description: z.string().optional(),
        quantity: z.coerce.number().positive("Qty > 0"),
        rate: z.coerce.number().min(0),
      })
    )
    .min(1, "Add at least one item"),
})
  // An elastic line must IDENTIFY its elastic, not just name it.
  // Everything downstream keys on the id: without one no stock moves,
  // no reservation is settled, and the despatch never appears against
  // the order. The line used to be free text, so a row added by hand
  // produced a challan that printed and shipped and counted for
  // nothing. The server refuses it too — this is here so the refusal
  // lands on the row rather than as a toast about the whole form.
  .superRefine((v, ctx) => {
    if (v.type !== "elastic") return;
    v.items.forEach((item, i) => {
      if (!item.elastic) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", i, "elastic"],
          message: "Pick the elastic",
        });
      }
    });
  });

export function DcForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: DcFormValues) => void;
  onCancel: () => void;
}) {
  // Order link is optional — Approved/InProgress orders can prefill
  // customer + items (and let the backend consume reservations).
  const approved = useOrders("Approved");
  const inProgress = useOrders("InProgress");
  const [orderId, setOrderId] = useState("");
  const orderInfo = useDcOrderInfo(orderId || undefined);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DcFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "elastic",
      customerName: "",
      dispatchDate: new Date().toISOString().slice(0, 10),
      items: [{ elastic: "", elasticName: "", quantity: 0, rate: 0 }],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const type = watch("type");
  const items = watch("items");

  const orderOptions = [...approved.orders, ...inProgress.orders].map((o) => ({
    value: o._id,
    label: `#${o.orderNo} — ${o.customer?.name ?? ""} (${o.status})`,
  }));

  // The combobox hands back an id, not the option, so every option that
  // passes through is remembered and the line's name can follow its id.
  const [labelById, setLabelById] = useState<Record<string, string>>({});
  const loadElastics = useCallback(async (q: string) => {
    const r = await elasticService.list({ page: 1, search: q, limit: 50 });
    const options = r.elastics.map((e) => ({ value: e._id, label: e.name }));
    setLabelById((prev) => ({
      ...prev,
      ...Object.fromEntries(options.map((o) => [o.value, o.label])),
    }));
    return options;
  }, []);
  // Rows prefilled from the linked order show their name before any
  // search has run.
  const elasticSeed = (orderInfo.data?.elastics ?? []).map((e) => ({
    value: e.elasticId,
    label: e.elasticName,
  }));

  // Prefill from the selected order.
  useEffect(() => {
    const info = orderInfo.data;
    if (!info) return;
    setValue("orderId", orderId);
    setValue("orderNo", info.orderNo);
    setValue("customerName", info.customer.name);
    setValue("customerPhone", info.customer.phone);
    setValue("customerGstin", info.customer.gstin);
    replace(
      info.elastics.map((e) => ({
        elastic: e.elasticId,
        elasticName: e.elasticName,
        quantity: 0,
        rate: 0,
      }))
    );
  }, [orderInfo.data, orderId, setValue, replace]);

  const total = (items ?? []).reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0),
    0
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Type *"
          options={[
            { value: "elastic", label: "Elastic (deducts stock)" },
            { value: "machine_part", label: "Machine part" },
          ]}
          {...register("type")}
        />
        <Combobox
          label="Link to order (optional)"
          placeholder="No order — manual DC"
          options={orderOptions}
          value={orderId}
          onChange={setOrderId}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Customer name *" error={errors.customerName?.message} {...register("customerName")} />
        <Input label="Phone" {...register("customerPhone")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="GSTIN" {...register("customerGstin")} />
        <Input label="Dispatch date" type="date" {...register("dispatchDate")} />
      </div>
      <Input label="Address" {...register("customerAddress")} />

      <div className="grid grid-cols-4 gap-3">
        <Input label="Vehicle no" {...register("vehicleNo")} />
        <Input label="Driver" {...register("driverName")} />
        <Input label="Transporter" {...register("transporter")} />
        <Input label="LR number" {...register("lrNumber")} />
      </div>

      <div>
        <p className="text-sm font-medium text-ink-600 mb-1.5">Items *</p>
        {/* Column headers label the repeating row inputs — a per-input label
            on every row would repeat itself down the whole table. */}
        {/* Rate is captured but never printed: a delivery challan is not a
            tax invoice, so the document carries quantity only. The value is
            kept because the Dispatch Report is built on it. Saying so here
            stops it looking like an omission on the printed challan. */}
        <div className="grid grid-cols-[1fr_90px_100px_36px] gap-2 px-1 pb-1 text-xs font-medium text-ink-400">
          <span>{type === "elastic" ? "Elastic" : "Part description"}</span>
          <span>Qty</span>
          <span className="flex items-center gap-1">
            Rate (₹)
            <span
              title="Internal only — used by the Dispatch Report. Never printed on the challan."
              className="cursor-help rounded bg-ink-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500"
            >
              internal
            </span>
          </span>
          <span className="sr-only">Remove</span>
        </div>
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_90px_100px_36px] gap-2 items-start">
              {type === "elastic" ? (
                <Controller
                  control={control}
                  name={`items.${i}.elastic`}
                  render={({ field: f }) => (
                    <AsyncCombobox
                      aria-label="Elastic"
                      placeholder="Select elastic"
                      loadOptions={loadElastics}
                      seedOptions={elasticSeed}
                      error={errors.items?.[i]?.elastic?.message}
                      value={f.value ?? ""}
                      onChange={(v) => {
                        f.onChange(v);
                        // The stored line also carries the name — it is
                        // what the printed challan and the PDF show — so
                        // it has to follow the id, not lag behind it.
                        setValue(`items.${i}.elasticName`, labelById[v] ?? "");
                      }}
                    />
                  )}
                />
              ) : (
                <Input
                  aria-label="Part description"
                  placeholder="Part description"
                  {...register(`items.${i}.description`)}
                />
              )}
              <Input
                type="number"
                step="0.01"
                aria-label="Quantity"
                placeholder="Qty"
                error={errors.items?.[i]?.quantity?.message}
                {...register(`items.${i}.quantity`)}
              />
              <Input
                type="number"
                step="0.01"
                aria-label="Rate in rupees (internal — not printed on the challan)"
                placeholder="Rate ₹"
                title="Internal only — used by the Dispatch Report. Never printed on the challan."
                {...register(`items.${i}.rate`)}
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => append({ elastic: "", elasticName: "", quantity: 0, rate: 0 })}
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>

      <Input label="Remarks" {...register("remarks")} />

      <div className="rounded-lg bg-ink-50 px-3 py-2 text-right text-sm text-ink-600">
        <p>
          Dispatch value:{" "}
          <span className="font-bold tabular-nums text-ink-900">
            ₹{total.toLocaleString("en-IN")}
          </span>
        </p>
        <p className="text-xs text-ink-400">
          Internal — feeds the Dispatch Report. The printed challan shows
          quantity only.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Create DC</Button>
      </div>
    </form>
  );
}
