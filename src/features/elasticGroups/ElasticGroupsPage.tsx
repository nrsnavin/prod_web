import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Layers, Pencil, Trash2, Building2, Globe } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useElasticGroups, useElasticGroupMutations } from "./hooks";
import { ElasticGroup, itemElasticName } from "./types";
import { ElasticGroupForm } from "./ElasticGroupForm";

export function ElasticGroupsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useElasticGroups();
  const { create, update, remove } = useElasticGroupMutations();
  const [editing, setEditing] = useState<ElasticGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ElasticGroup | null>(null);

  return (
    <>
      <PageHeader
        title="Elastic groups"
        subtitle="Reusable bundles of elastics you can drop into an order or delivery challan in one click."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New group
          </Button>
        }
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-12 w-12" />}
            title="No elastic groups yet"
            description="Create a group of elastics for a customer (or a global bundle) to speed up order entry."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data!.map((g) => (
            <Card
              key={g._id}
              onClick={() => navigate(`/elastic-groups/${g._id}`)}
              className="flex cursor-pointer flex-col p-4 transition-colors hover:border-brand-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{g.name}</p>
                  <div className="mt-1">
                    {g.customer ? (
                      <StatusChip tone="info">
                        <Building2 className="mr-1 inline h-3 w-3" />
                        {g.customer.name}
                      </StatusChip>
                    ) : (
                      <StatusChip tone="neutral">
                        <Globe className="mr-1 inline h-3 w-3" /> Global
                      </StatusChip>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(g); }}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleting(g); }}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                {g.items.length} elastic{g.items.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-600">
                {g.items.slice(0, 4).map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{itemElasticName(it)}</span>
                    {it.defaultQuantity > 0 && (
                      <span className="shrink-0 tabular-nums text-ink-400">{it.defaultQuantity.toLocaleString("en-IN")} m</span>
                    )}
                  </li>
                ))}
                {g.items.length > 4 && <li className="text-xs text-ink-400">+{g.items.length - 4} more</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <FormScreen open={creating} onClose={() => setCreating(false)} title="New elastic group" width="max-w-2xl">
        <ElasticGroupForm
          submitting={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreating(false);
                toast("Group created", "success");
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to create group", "error"),
            })
          }
        />
      </FormScreen>

      {editing && (
        <FormScreen open onClose={() => setEditing(null)} title="Edit elastic group" width="max-w-2xl">
          <ElasticGroupForm
            initial={editing}
            submitting={update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(values) =>
              update.mutate(
                { id: editing._id, body: values },
                {
                  onSuccess: () => {
                    setEditing(null);
                    toast("Group updated", "success");
                  },
                  onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
                }
              )
            }
          />
        </FormScreen>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete elastic group?"
        message={deleting ? `"${deleting.name}" will be removed. Orders already created are unaffected.` : ""}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting._id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Group deleted", "success");
            },
            onError: (e) => toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />
    </>
  );
}
