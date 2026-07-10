import { useCallback, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Plus, Trash2, Building2, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMaterials } from "@/features/materials/hooks";
import { supplierService } from "./api";
import { PoFormValues, Supplier } from "./types";
import { usePoMutations } from "./hooks";

const schema = z.object({
  supplier: z.string().min(1, "Select a supplier"),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        rawMaterial: z.string().min(1, "Select material"),
        quantity: z.coerce.number().positive("Qty > 0"),
        price: z.coerce.number().positive("Rate > 0"),
      })
    )
    .min(1, "Add at least one item"),
});

const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function PoCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { create } = usePoMutations();

  // Supplier picker searches the server; cache the full records we see so the
  // vendor-detail card can still resolve GSTIN/phone/address for the pick.
  const [supplierCache, setSupplierCache] = useState<Map<string, Supplier>>(new Map());
  const loadSuppliers = useCallback(
    (q: string) =>
      supplierService.list({ page: 1, search: q, limit: 50 }).then((r) => {
        setSupplierCache((prev) => {
          const next = new Map(prev);
          for (const s of r.suppliers) next.set(s._id, s);
          return next;
        });
        return r.suppliers.map((s) => ({ value: s._id, label: s.name }));
      }),
    []
  );
  const materials = useMaterials({ search: "", category: "all", lowStock: false });

  // Optional prefill from the replenishment forecast ("Draft PO").
  const prefill = (useLocation().state as { prefill?: { supplier: string; supplierName?: string; items: Array<{ rawMaterial: string; quantity: number; price: number }> } } | null)?.prefill;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier: prefill?.supplier ?? "",
      expectedDate: "",
      notes: "",
      items:
        prefill?.items && prefill.items.length > 0
          ? prefill.items
          : [{ rawMaterial: "", quantity: 0, price: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = watch("items");
  const supplierId = watch("supplier");
  const total = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0),
    0
  );
  const lineCount = items.filter((i) => i.rawMaterial && Number(i.quantity) > 0).length;

  const selectedSupplier = supplierId ? supplierCache.get(supplierId) : undefined;

  const materialById = useMemo(() => {
    const m = new Map<string, { name: string; unit?: string }>();
    for (const it of materials.data ?? []) m.set(it._id, { name: it.name, unit: (it as { unit?: string }).unit });
    return m;
  }, [materials.data]);

  const materialOptions = (materials.data ?? []).map((m) => ({
    value: m._id,
    label: `${m.name} (${m.category})`,
  }));

  const submit = (values: PoFormValues) =>
    create.mutate(
      {
        ...values,
        expectedDate: values.expectedDate || undefined,
        notes: values.notes?.trim() || undefined,
      },
      {
        onSuccess: (po) => {
          toast(`PO #${po.poNo} created`, "success");
          navigate(`/purchase-orders/${po._id}`);
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to create PO", "error"),
      }
    );

  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <Link to="/purchase-orders" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Purchase orders
      </Link>
      <PageHeader
        title="New purchase order"
        subtitle="Raise a purchase order for raw materials."
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => navigate("/purchase-orders")}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              <ShoppingCart className="h-4 w-4" /> Create PO
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Vendor</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="supplier"
                render={({ field }) => (
                  <AsyncCombobox
                    label="Supplier *"
                    placeholder="Select supplier"
                    loadOptions={loadSuppliers}
                    seedOptions={
                      prefill?.supplier && prefill.supplierName
                        ? [{ value: prefill.supplier, label: prefill.supplierName }]
                        : undefined
                    }
                    error={errors.supplier?.message}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Input label="Requested delivery date" type="date" {...register("expectedDate")} />
            </div>

            {selectedSupplier && (
              <div className="mt-3 rounded-lg bg-canvas p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  <Building2 className="h-4 w-4 text-ink-400" /> {selectedSupplier.name}
                </p>
                <div className="mt-1 grid gap-x-6 gap-y-0.5 text-ink-600 sm:grid-cols-2">
                  {selectedSupplier.gstin && <p>GSTIN: {selectedSupplier.gstin}</p>}
                  {selectedSupplier.phoneNumber && <p>Ph: {selectedSupplier.phoneNumber}</p>}
                  {selectedSupplier.contactPerson && <p>Contact: {selectedSupplier.contactPerson}</p>}
                  {selectedSupplier.email && <p>{selectedSupplier.email}</p>}
                  {selectedSupplier.address && <p className="sm:col-span-2">{selectedSupplier.address}</p>}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold">Line items</h3>
            {/* Column header */}
            <div className="hidden grid-cols-[1fr_90px_110px_120px_36px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
              <span>Material</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate (₹)</span>
              <span className="text-right">Amount (₹)</span>
              <span />
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => {
                const amount = (Number(items[i]?.quantity) || 0) * (Number(items[i]?.price) || 0);
                const unit = materialById.get(items[i]?.rawMaterial)?.unit;
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_90px_110px_120px_36px] sm:items-start"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <Controller
                        control={control}
                        name={`items.${i}.rawMaterial`}
                        render={({ field }) => (
                          <Combobox
                            placeholder="Material"
                            options={materialOptions}
                            error={errors.items?.[i]?.rawMaterial?.message}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    </div>
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
                      placeholder="Rate"
                      error={errors.items?.[i]?.price?.message}
                      {...register(`items.${i}.price`)}
                    />
                    <div className="flex h-10 items-center justify-end rounded-lg bg-canvas px-3 text-sm tabular-nums">
                      {amount > 0 ? `₹${inr(amount)}` : <span className="text-ink-400">—</span>}
                      {unit && amount > 0 && <span className="ml-1 text-xs text-ink-400">/{unit}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => fields.length > 1 && remove(i)}
                      className="hidden h-10 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger disabled:opacity-40 sm:grid"
                      disabled={fields.length <= 1}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
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
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 font-semibold">Terms & notes</h3>
            <textarea
              {...register("notes")}
              rows={3}
              placeholder="Payment terms, delivery instructions, packaging, etc."
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-5 lg:sticky lg:top-4">
            <h3 className="mb-3 font-semibold">Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-400">Supplier</dt>
                <dd className="font-medium">{selectedSupplier?.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-400">Line items</dt>
                <dd className="tabular-nums">{lineCount}</dd>
              </div>
              <div className="my-2 border-t border-ink-100" />
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-600">Order total</dt>
                <dd className="text-2xl font-bold tabular-nums">₹{inr(total)}</dd>
              </div>
            </dl>
            <Button type="submit" className="mt-4 w-full" loading={create.isPending}>
              <ShoppingCart className="h-4 w-4" /> Create PO
            </Button>
            <p className="mt-2 text-center text-xs text-ink-400">
              A printable PO document is available after creation.
            </p>
          </Card>
        </div>
      </div>
    </form>
  );
}
