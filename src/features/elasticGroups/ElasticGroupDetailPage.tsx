import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2, Building2, Globe, Cable } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { breakdownService } from "@/features/analytics/breakdown/api";
import { useElasticGroup, useElasticGroupMutations } from "./hooks";
import { ElasticGroupItem, itemElasticName } from "./types";
import { ElasticGroupForm } from "./ElasticGroupForm";

const itemColumns: Column<ElasticGroupItem & { _i: number }>[] = [
  { key: "elastic", header: "Elastic", render: (it) => <span className="font-medium">{itemElasticName(it)}</span> },
  {
    key: "weave",
    header: "Weave",
    render: (it) => (typeof it.elastic === "object" && it.elastic?.weaveType) || "—",
  },
  {
    key: "qty",
    header: "Default qty (m)",
    align: "right",
    render: (it) => (it.defaultQuantity > 0 ? it.defaultQuantity.toLocaleString("en-IN") : "—"),
  },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ElasticGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: group, isLoading, isError, error } = useElasticGroup(id);
  const { update, remove } = useElasticGroupMutations();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 30-day production/wastage rollup for this group (from the breakdown).
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    return { start: iso(start), end: iso(end) };
  }, []);
  const stats = useQuery({
    queryKey: ["group-breakdown", id, range],
    queryFn: () => breakdownService.get({ start: range.start, end: range.end, groupBy: "group", shift: "all" }),
    enabled: !!id,
  });
  const myRow = (stats.data?.rows ?? []).find((r) => r.key === id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !group) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Elastic group not found"}
      </p>
    );
  }

  const rows = group.items.map((it, _i) => ({ ...it, _i }));

  return (
    <>
      <Link to="/elastic-groups" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Elastic groups
      </Link>
      <PageHeader
        title={group.name}
        subtitle={`${group.items.length} elastic${group.items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      />

      <div className="mb-4">
        {group.customer ? (
          <Link to={`/customers/${group.customer._id}`}>
            <StatusChip tone="info">
              <Building2 className="mr-1 inline h-3 w-3" /> {group.customer.name}
            </StatusChip>
          </Link>
        ) : (
          <StatusChip tone="neutral">
            <Globe className="mr-1 inline h-3 w-3" /> Global bundle
          </StatusChip>
        )}
      </div>

      {/* 30-day rollup */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Production (30d)" value={myRow ? `${myRow.production.toLocaleString("en-IN")} m` : stats.isLoading ? "…" : "—"} />
        <StatTile label="Wastage (30d)" value={myRow ? `${myRow.wastageQty.toLocaleString("en-IN")} m` : stats.isLoading ? "…" : "—"} />
        <StatTile label="Wastage rate" value={myRow ? `${myRow.wastageRate}%` : stats.isLoading ? "…" : "—"} />
        <StatTile label="Elastics" value={String(group.items.length)} />
      </div>

      <Card>
        <h3 className="flex items-center gap-2 px-5 pt-5 font-semibold">
          <Cable className="h-4 w-4 text-ink-400" /> Elastics in this group
        </h3>
        <DataTable columns={itemColumns} rows={rows} rowKey={(r) => `${r._i}`} emptyTitle="No elastics" />
      </Card>

      <p className="mt-3 text-xs text-ink-400">
        30-day figures are a rollup of this group's elastics across all customers (see Analytics → Breakdown → Group).
      </p>

      {editing && (
        <Modal open onClose={() => setEditing(false)} title="Edit elastic group" width="max-w-2xl">
          <ElasticGroupForm
            initial={group}
            submitting={update.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(values) =>
              update.mutate(
                { id: group._id, body: values },
                {
                  onSuccess: () => {
                    setEditing(false);
                    toast("Group updated", "success");
                  },
                  onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
                }
              )
            }
          />
        </Modal>
      )}

      <ConfirmDialog
        open={deleting}
        title="Delete elastic group?"
        message={`"${group.name}" will be removed.`}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          remove.mutate(group._id, {
            onSuccess: () => {
              toast("Group deleted", "success");
              navigate("/elastic-groups");
            },
            onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />
    </>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
