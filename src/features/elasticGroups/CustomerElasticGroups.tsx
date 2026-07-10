import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useElasticGroups, useElasticGroupMutations } from "./hooks";
import { ElasticGroup, itemElasticName } from "./types";
import { ElasticGroupForm } from "./ElasticGroupForm";

// Groups section shown on a customer's detail page. Lists only groups
// owned by this customer (global bundles are managed on the Masters page).
export function CustomerElasticGroups({ customerId }: { customerId: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data } = useElasticGroups(customerId);
  const { create, update, remove } = useElasticGroupMutations();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ElasticGroup | null>(null);
  const [deleting, setDeleting] = useState<ElasticGroup | null>(null);

  const groups = (data ?? []).filter((g) => g.customer?._id === customerId);

  return (
    <Card className="mt-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">
          <Layers className="h-4 w-4 text-brand-500" /> Elastic groups
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-ink-400">
          No groups for this customer yet. Create one to add its elastics to an order in a click.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {groups.map((g) => (
            <li key={g._id} className="flex items-start gap-3 py-2.5">
              <button
                onClick={() => navigate(`/elastic-groups/${g._id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-medium hover:text-brand-600">{g.name}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {g.items.map((it) => itemElasticName(it)).slice(0, 4).join(", ")}
                  {g.items.length > 4 && ` +${g.items.length - 4} more`}
                </p>
              </button>
              <span className="shrink-0 text-xs text-ink-400">{g.items.length} elastics</span>
              <button onClick={() => setEditing(g)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => setDeleting(g)} className="rounded-lg p-1.5 text-ink-400 hover:bg-status-dangerBg hover:text-status-danger" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New elastic group" width="max-w-2xl">
        <ElasticGroupForm
          fixedCustomerId={customerId}
          submitting={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            create.mutate(
              { ...values, customer: customerId },
              {
                onSuccess: () => {
                  setCreating(false);
                  toast("Group created", "success");
                },
                onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to create group", "error"),
              }
            )
          }
        />
      </Modal>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title="Edit elastic group" width="max-w-2xl">
          <ElasticGroupForm
            initial={editing}
            fixedCustomerId={customerId}
            submitting={update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(values) =>
              update.mutate(
                { id: editing._id, body: { ...values, customer: customerId } },
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
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete elastic group?"
        message={deleting ? `"${deleting.name}" will be removed.` : ""}
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
    </Card>
  );
}
