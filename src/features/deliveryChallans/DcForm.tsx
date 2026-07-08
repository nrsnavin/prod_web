import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
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
      items: [{ elasticName: "", quantity: 0, rate: 0 }],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const type = watch("type");
  const items = watch("items");

  const orderOptions = [...(approved.data ?? []), ...(inProgress.data ?? [])].map((o) => ({
    value: o._id,
    label: `#${o.orderNo} — ${o.customer?.name ?? ""} (${o.status})`,
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
        <Select
          label="Link to order (optional)"
          placeholder="No order — manual DC"
          options={orderOptions}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
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
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-[1fr_90px_100px_36px] gap-2 items-start">
              <Input
                placeholder={type === "elastic" ? "Elastic name" : "Part description"}
                {...register(type === "elastic" ? `items.${i}.elasticName` : `items.${i}.description`)}
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
                placeholder="Rate ₹"
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
          onClick={() => append({ elasticName: "", quantity: 0, rate: 0 })}
        >
          <Plus className="h-4 w-4" /> Add item
        </Button>
      </div>

      <Input label="Remarks" {...register("remarks")} />

      <p className="text-sm text-ink-600 text-right">
        Total: <span className="font-bold tabular-nums">₹{total.toLocaleString()}</span>
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Create DC</Button>
      </div>
    </form>
  );
}
