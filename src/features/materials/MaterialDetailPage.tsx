import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Scale } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMaterial, useMaterialMutations } from "./hooks";
import { StockMovement } from "./types";
import { MaterialForm } from "./MaterialForm";

const movementColumns: Column<StockMovement>[] = [
  { key: "date", header: "Date", render: (m) => new Date(m.date).toLocaleDateString() },
  {
    key: "type",
    header: "Type",
    render: (m) => (
      <StatusChip tone={m.quantity >= 0 ? "success" : "warning"}>{m.type}</StatusChip>
    ),
  },
  {
    key: "qty",
    header: "Quantity",
    align: "right",
    render: (m) => (
      <span className={m.quantity < 0 ? "text-status-danger" : "text-status-success"}>
        {m.quantity > 0 ? "+" : ""}
        {m.quantity.toLocaleString("en-IN")}
      </span>
    ),
  },
  { key: "balance", header: "Balance", align: "right", render: (m) => m.balance?.toLocaleString("en-IN") ?? "—" },
  { key: "reason", header: "Reason / Ref", render: (m) => m.reason || m.order || "—" },
];

const adjustSchema = z.object({
  adjustment: z.coerce
    .number()
    .refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().min(1, "Reason is required"),
});
type AdjustValues = z.infer<typeof adjustSchema>;

function AdjustStockForm({
  currentStock,
  submitting,
  onSubmit,
  onCancel,
}: {
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
    defaultValues: { adjustment: 0, reason: "" },
  });
  const adj = Number(watch("adjustment")) || 0;
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
  const { update, remove, adjustStock } = useMaterialMutations();
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
        subtitle={material.category}
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
              <Scale className="h-4 w-4" /> Adjust stock
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
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
        <Card className="p-5">
          <p className="text-sm text-ink-400">Price</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">₹{material.price.toLocaleString("en-IN")}</p>
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

      <Card className="mt-4">
        <h3 className="font-semibold px-5 pt-5">Stock movements</h3>
        <DataTable
          columns={movementColumns}
          rows={material.stockMovements ?? []}
          rowKey={(m, ) => `${m.date}-${m.type}-${m.quantity}-${m.balance ?? ""}`}
          emptyTitle="No stock movements"
          emptyDescription="Inwards, consumption and adjustments will appear here."
        />
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit material">
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
      </Modal>

      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust stock">
        <AdjustStockForm
          currentStock={material.stock}
          submitting={adjustStock.isPending}
          onCancel={() => setAdjustOpen(false)}
          onSubmit={({ adjustment, reason }) =>
            adjustStock.mutate(
              { id: material._id, adjustment, reason },
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
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete material?"
        message={`${material.name} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          remove.mutate(material._id, {
            onSuccess: () => {
              toast("Material deleted", "success");
              navigate("/materials");
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />
    </>
  );
}
