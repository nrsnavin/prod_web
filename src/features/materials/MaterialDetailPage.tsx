import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Scale, Archive, ArchiveRestore } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMaterial, useMaterialMutations, useYarnLots } from "./hooks";
import { MaterialForm } from "./MaterialForm";
import { MaterialLots } from "./MaterialLots";
import { MaterialLedgerCard } from "./MaterialLedgerCard";

const adjustSchema = z.object({
  adjustment: z.coerce
    .number()
    .refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(1, "Reason is required"),
  // Which dye lot the stock is going into or coming out of. Adding names
  // a lot number (opening the bucket if it is new); removing picks an
  // existing one. Optional either way — untracked or undyed material has
  // no lot, and stock nobody can place should not be blocked on
  // inventing one.
  lotNo: z.string().optional(),
  shade: z.string().optional(),
  yarnLot: z.string().optional(),
});
type AdjustValues = z.infer<typeof adjustSchema>;

function AdjustStockForm({
  materialId,
  currentStock,
  submitting,
  onSubmit,
  onCancel,
}: {
  materialId: string;
  currentStock: number;
  submitting: boolean;
  onSubmit: (v: AdjustValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AdjustValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { adjustment: 0, reason: "", lotNo: "", shade: "", yarnLot: "" },
  });
  const adj = Number(watch("adjustment")) || 0;
  // Only lots with something left can be drawn from.
  const { data: lots } = useYarnLots({ material: materialId, issuable: true, enabled: adj < 0 });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label="Adjustment (+ adds, − removes) *"
        type="number"
        step="0.01"
        error={errors.adjustment?.message}
        {...register("adjustment")}
      />
      <Input
        label="Reason *"
        placeholder="e.g. Physical count correction"
        error={errors.reason?.message}
        {...register("reason")}
      />

      {/* The lot side of the same movement. Without it a count
          correction moves the aggregate while leaving the lot ledger
          behind, and the two drift apart with every adjustment. */}
      {adj > 0 && (
        <div className="rounded-xl border border-ink-100 p-3">
          <p className="text-sm font-medium">Dye lot</p>
          <p className="text-xs text-ink-400">
            Which lot this stock belongs to. A new number opens a lot; an existing
            one is topped up. Leave blank if it cannot be placed.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input aria-label="Lot no" placeholder="Lot no" {...register("lotNo")} />
            <Input aria-label="Shade" placeholder="Shade (optional)" {...register("shade")} />
          </div>
        </div>
      )}

      {adj < 0 && (
        <div className="rounded-xl border border-ink-100 p-3">
          <p className="text-sm font-medium">Dye lot</p>
          <p className="text-xs text-ink-400">
            Which lot the stock is coming out of. Leave blank if it cannot be placed.
          </p>
          {(lots?.length ?? 0) === 0 ? (
            <p className="mt-1 text-xs text-status-warning">
              No open lots for this material.
            </p>
          ) : (
            <Select
              className="mt-2"
              aria-label="Dye lot"
              placeholder="No lot"
              options={(lots ?? []).map((l) => ({
                value: l._id,
                label: `${l.lotNo}${l.shade ? ` \u00b7 ${l.shade}` : ""} \u2014 ${l.balance.toLocaleString("en-IN")} left`,
              }))}
              {...register("yarnLot")}
            />
          )}
        </div>
      )}

      <p className="text-sm text-ink-600">
        New stock:{" "}
        <span className="font-semibold tabular-nums">
          {(currentStock + adj).toLocaleString("en-IN")}
        </span>
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Adjust stock</Button>
      </div>
    </form>
  );
}

export function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: material, isLoading, isError, error } = useMaterial(id);
  const { update, remove, setArchived, adjustStock } = useMaterialMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !material) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Material not found"}
      </p>
    );
  }

  const low = material.stock <= material.minStock;

  return (
    <>
      <Link to="/materials" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Raw materials
      </Link>
      <PageHeader
        title={material.name}
        subtitle={
          material.archived
            ? `${material.category} · archived — hidden from the pickers, history intact`
            : material.category
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
              <Scale className="h-4 w-4" /> Adjust stock
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {/*
              The deliberate version of what Remove falls back to. Worth
              its own button: archiving a material you have stopped
              buying is a normal thing to want, and reaching it by
              pressing Delete and reading the small print is not a way
              to offer it.
            */}
            <Button
              variant="secondary"
              loading={setArchived.isPending}
              onClick={() =>
                setArchived.mutate(
                  { id: material._id, archived: !material.archived },
                  {
                    onSuccess: (r) => toast(r.message ?? "Updated", "success"),
                    onError: (e) =>
                      toast(e instanceof ApiError ? e.message : "Failed", "error"),
                  }
                )
              }
            >
              {material.archived ? (
                <><ArchiveRestore className="h-4 w-4" /> Restore</>
              ) : (
                <><Archive className="h-4 w-4" /> Archive</>
              )}
            </Button>
            {/* Icon-only, so it needs a name of its own — otherwise it
                is an unlabelled button to a screen reader. */}
            <Button
              variant="danger"
              aria-label="Remove material"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-ink-400">Current stock</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${low ? "text-status-danger" : ""}`}>
            {material.stock.toLocaleString("en-IN")}
          </p>
          {low && <StatusChip tone="danger" className="mt-2">Below minimum</StatusChip>}
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-400">Minimum stock</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{material.minStock.toLocaleString("en-IN")}</p>
        </Card>
        {/*
          Two different numbers that used to be one. `price` is the
          latest purchase price — what a new PO defaults to. `unitCost`
          is the weighted average of what the stock on hand actually
          cost, and it is what issues are costed at. On a moving yarn
          market they diverge, and showing only the first is what made
          consumption read high every time a supplier raised a quote.
        */}
        <Card className="p-5">
          <p className="text-sm text-ink-400">Average cost</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            ₹{(material.unitCost ?? material.price).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {material.avgCost
              ? `Latest purchase ₹${material.price.toLocaleString("en-IN")}`
              : "No receipt since averaging — latest purchase price"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-400">Stock value</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            ₹
            {(
              material.stockValue ?? material.stock * (material.unitCost ?? material.price)
            ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-6">
        <DescriptionList
          columns={3}
          items={[
            {
              label: "Supplier",
              value:
                typeof material.supplier === "object" && material.supplier
                  ? material.supplier.name
                  : undefined,
            },
            { label: "Category", value: material.category },
            { label: "Total consumed", value: (material.totalConsumption ?? 0).toLocaleString("en-IN") },
          ]}
        />
      </Card>

      <MaterialLots
        materialId={material._id}
        lots={material.lots ?? []}
        unplaced={material.unplacedQty ?? 0}
      />

      <MaterialLedgerCard materialId={material._id} unit={material.unit} />

      <FormScreen open={editOpen} onClose={() => setEditOpen(false)} title="Edit material">
        <MaterialForm
          initial={material}
          submitting={update.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={(values) =>
            update.mutate(
              { id: material._id, body: values },
              {
                onSuccess: () => {
                  setEditOpen(false);
                  toast("Material updated", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Update failed", "error"),
              }
            )
          }
        />
      </FormScreen>

      <FormScreen open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust stock">
        <AdjustStockForm
          materialId={material._id}
          currentStock={material.stock}
          submitting={adjustStock.isPending}
          onCancel={() => setAdjustOpen(false)}
          onSubmit={({ adjustment, reason, lotNo, shade, yarnLot }) =>
            adjustStock.mutate(
              { id: material._id, adjustment, reason, lotNo, shade, yarnLot },
              {
                onSuccess: () => {
                  setAdjustOpen(false);
                  toast("Stock adjusted", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Adjustment failed", "error"),
              }
            )
          }
        />
      </FormScreen>

      <ConfirmDialog
        open={deleteOpen}
        title="Remove material?"
        message={`${material.name} is deleted only if nothing has ever used it. Once an order, purchase order, goods receipt or elastic recipe names it, it is archived instead — out of the pickers, with all history intact.`}
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          remove.mutate(material._id, {
            // Say what actually happened, in the server's words —
            // reporting a deletion for a material that is merely
            // archived sends somebody hunting for a row that is still
            // there.
            onSuccess: (result) => {
              toast(result.message, "success");
              if (result.deleted) navigate("/materials");
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />
    </>
  );
}
