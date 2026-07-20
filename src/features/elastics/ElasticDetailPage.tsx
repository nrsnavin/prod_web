import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Calculator, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useElastic, useElasticMutations } from "./hooks";
import { MaterialWeight } from "./types";
import { ElasticForm } from "./ElasticForm";

function materialName(mw?: MaterialWeight): string {
  if (!mw?.id) return "—";
  return typeof mw.id === "object" ? mw.id.name : String(mw.id);
}

function CompositionRow({ label, mw }: { label: string; mw?: MaterialWeight }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-xs text-ink-400">{label}</p>
        <p className="text-sm font-medium">{materialName(mw)}</p>
      </div>
      <span className="text-sm tabular-nums text-ink-600">
        {mw?.weight != null ? `${mw.weight} g/m` : "—"}
      </span>
    </div>
  );
}

export function ElasticDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: elastic, isLoading, isError, error } = useElastic(id);
  const { update, recalculate, setArchived, remove } = useElasticMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !elastic) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Elastic not found"}
      </p>
    );
  }

  return (
    <>
      <Link to="/elastics" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Elastic products
      </Link>
      <PageHeader
        title={elastic.name}
        subtitle={elastic.weaveType}
        actions={
          <>
            {elastic.archived && <StatusChip tone="warning">Inactive</StatusChip>}
            <Button
              variant="secondary"
              loading={recalculate.isPending}
              onClick={() =>
                recalculate.mutate(elastic._id, {
                  onSuccess: () => toast("Cost recalculated with current prices", "success"),
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Recalculation failed", "error"),
                })
              }
            >
              <Calculator className="h-4 w-4" /> Recalculate cost
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="secondary" onClick={() => setArchiveOpen(true)}>
              {elastic.archived
                ? <><ArchiveRestore className="h-4 w-4" /> Reactivate</>
                : <><Archive className="h-4 w-4" /> Mark inactive</>}
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={archiveOpen}
        title={elastic.archived ? `Reactivate ${elastic.name}` : `Mark ${elastic.name} inactive`}
        message={
          elastic.archived
            ? "The elastic becomes visible again in lists and order forms."
            : "Hidden from lists and new-order pickers. Existing orders, stock history and DCs keep their records. You can reactivate any time."
        }
        confirmLabel={elastic.archived ? "Reactivate" : "Mark inactive"}
        loading={setArchived.isPending}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={() =>
          setArchived.mutate(
            { id: elastic._id, archived: !elastic.archived },
            {
              onSuccess: (r) => {
                setArchiveOpen(false);
                toast(r.message ?? (elastic.archived ? "Reactivated" : "Marked inactive"), "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Update failed", "error"),
            }
          )
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${elastic.name}?`}
        message="Permanent. Only possible while the elastic has no stock, no reservations and no stock movements — otherwise use Mark inactive, which keeps all history."
        confirmLabel="Delete permanently"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          remove.mutate(elastic._id, {
            onSuccess: () => {
              toast("Elastic deleted", "success");
              navigate("/elastics");
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-ink-400">Total cost</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {elastic.costing?.totalCost != null ? `₹${elastic.costing.totalCost.toLocaleString("en-IN")}` : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-400">per metre</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-400">Material / conversion</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {elastic.costing?.materialCost != null ? `₹${elastic.costing.materialCost.toLocaleString("en-IN")}` : "—"}
            <span className="text-base font-medium text-ink-400">
              {" "}+ ₹{(elastic.costing?.conversionCost ?? 0).toLocaleString("en-IN")}
            </span>
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-ink-400">Stock produced</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {(elastic.quantityProduced ?? 0).toLocaleString("en-IN")} m
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold">Composition</h3>
          <div className="mt-2 divide-y divide-ink-100">
            <CompositionRow label="Warp spandex" mw={elastic.warpSpandex} />
            <CompositionRow label="Spandex covering" mw={elastic.spandexCovering} />
            <CompositionRow label="Weft yarn" mw={elastic.weftYarn} />
            {(elastic.warpYarn ?? []).map((w, i) => (
              <CompositionRow key={i} label={`Warp yarn ${i + 1}`} mw={w} />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold">Construction</h3>
          <div className="mt-4">
            <DescriptionList
              columns={2}
              items={[
                { label: "Spandex ends", value: elastic.spandexEnds },
                { label: "Yarn ends", value: elastic.yarnEnds },
                { label: "Pick", value: elastic.pick },
                { label: "Hooks", value: elastic.noOfHook },
                { label: "Weight", value: elastic.weight != null ? `${elastic.weight} g/m` : undefined },
                {
                  label: "Created",
                  value: elastic.createdAt
                    ? new Date(elastic.createdAt).toLocaleDateString()
                    : undefined,
                },
              ]}
            />
          </div>
        </Card>
      </div>

      <FormScreen open={editOpen} onClose={() => setEditOpen(false)} title="Edit elastic" width="max-w-2xl">
        <ElasticForm
          initial={elastic}
          submitting={update.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={(values) =>
            update.mutate(
              { id: elastic._id, body: values },
              {
                onSuccess: () => {
                  setEditOpen(false);
                  toast("Elastic updated — costing recalculated", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Update failed", "error"),
              }
            )
          }
        />
      </FormScreen>
    </>
  );
}
