import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Scale } from "lucide-react";
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
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useMaterial, useMaterialMutations, useYarnLots } from "./hooks";
import { StockMovement } from "./types";
import { MaterialForm } from "./MaterialForm";
import { MaterialLots } from "./MaterialLots";

/**
 * The document behind a movement, or the reason someone typed.
 *
 * Exported for its own tests: reaching it through the page would mean
 * mocking every unrelated field the page renders, and the test would
 * then be about the mock.
 */
export function MovementReason({ movement: m }: { movement: StockMovement }) {
  const to =
    m.referenceKind === "order"
      ? `/orders/${m.referenceId}`
      : m.referenceKind === "purchaseOrder"
        ? `/purchase-orders/${m.referenceId}`
        : null;

  if (m.reference) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-1.5">
        {to && m.referenceId ? (
          <Link to={to} className="text-brand-600 hover:underline">
            {m.reference}
          </Link>
        ) : (
          <span>{m.reference}</span>
        )}
        {/* Matched from the inward history rather than recorded at the
            time. Saying so keeps a reconstruction from passing as a
            record. */}
        {m.referenceDerived && (
          <span className="text-xs text-ink-400" title="Matched from the inward history">
            matched
          </span>
        )}
      </span>
    );
  }
  if (m.reason) return <span className="text-ink-600">{m.reason}</span>;
  return <span className="text-ink-400">—</span>;
}

// Exported so a test can assert the Reason column is actually mounted.
// Testing the cell alone would pass with the column never added.
export const movementColumns: Column<StockMovement>[] = [
  { key: "date", header: "Date", render: (m) => new Date(m.date).toLocaleDateString() },
  {
    key: "type",
    header: "Type",
    render: (m) => (
      <StatusChip tone={m.quantity > 0 ? "success" : m.quantity < 0 ? "danger" : "neutral"}>
        {/* The server says it in words. `type` is a database value —
            ORDER_APPROVAL, PO_INWARD — not a sentence. */}
        {m.typeLabel ?? m.type}
      </StatusChip>
    ),
  },
  {
    key: "why",
    header: "Reason",
    cellClassName: "whitespace-normal",
    // The column the ledger was missing. A row reading "-40" with
    // nothing beside it is checkable but not explainable, and "why did
    // this drop by 40 in March" is the question the ledger exists for.
    render: (m) => <MovementReason movement={m} />,
  },
  {
    key: "qty",
    header: "Quantity",
    align: "right",
    // Sign written explicitly rather than left to toLocaleString: the
    // minus is the whole point of the column, and a "+" has to be added
    // by hand anyway. A zero gets neither, and is not coloured as a gain.
    render: (m) => (
      <span
        className={
          m.quantity > 0
            ? "text-status-success font-semibold tabular-nums"
            : m.quantity < 0
              ? "text-status-danger font-semibold tabular-nums"
              : "text-ink-400 tabular-nums"
        }
      >
        {m.quantity > 0 ? "+" : m.quantity < 0 ? "−" : ""}
        {Math.abs(m.quantity).toLocaleString("en-IN")}
        {/*
          Stock floors at zero, so a write-off can move less than was
          asked for. Saying so here is the difference between a row that
          explains a short write-off and one that looks like it lost a
          number — the quantity above is always what actually moved.
        */}
        {m.requested != null && m.requested !== m.quantity && (
          <span className="ml-1 block text-xs font-normal text-ink-400">
            asked {m.requested > 0 ? "+" : "−"}
            {Math.abs(m.requested).toLocaleString("en-IN")}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    render: (m) => (
      <span className="tabular-nums">
        {m.balance != null ? m.balance.toLocaleString("en-IN") : "—"}
      </span>
    ),
  },
  {
    key: "value",
    header: "Value (₹)",
    align: "right",
    // Priced from the cost recorded on the row, never from the
    // material's cost today: the average moves with every receipt, so
    // pricing an old movement at it would value the yarn at a cost it
    // never had. Rows written before costs were stamped show a dash
    // rather than a guess.
    render: (m) => (
      <span className="tabular-nums text-ink-600">
        {m.value == null ? "—" : Math.round(m.value).toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    key: "reason",
    header: "Reason / Ref",
    // `order` arrives populated from the detail endpoint, so it must be
    // read for its number rather than dropped into JSX — rendering the
    // object crashed the whole page with React error #31.
    render: (m) => {
      if (m.reason) return m.reason;
      if (!m.order) return "—";
      if (typeof m.order === "string") return m.order;
      return m.order.orderNo != null ? `Order #${m.order.orderNo}` : "—";
    },
  },
];

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
