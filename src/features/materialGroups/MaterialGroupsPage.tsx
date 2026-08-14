import { useMemo, useState } from "react";
import { Plus, Pencil, Archive, RotateCcw, Trash2, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import {
  useMaterialGroups,
  useCreateGroup,
  useUpdateGroup,
  useRemoveGroup,
  useRestoreGroup,
} from "./hooks";
import {
  GROUP_KINDS,
  MaterialGroup,
  MaterialGroupFormValues,
  MaterialGroupKind,
  emptyGroupForm,
} from "./types";

// ══════════════════════════════════════════════════════════════════
//  The one place the list of material groups is edited.
//
//  It used to be edited in eight source files that disagreed with each
//  other — see features/materialGroups/types.ts. A group added here is
//  live in the material form, the filter chips, the stock-count scope
//  picker, the MRP sheet and the phone, without a deployment.
// ══════════════════════════════════════════════════════════════════

const kindLabel: Record<MaterialGroupKind, string> = {
  position: "Position",
  material: "Material",
  other: "Other",
};

// The colours the phone has always drawn its category chips in, so a
// mill picking one here gets something that already looks native there
// rather than an arbitrary hex.
const SWATCHES = [
  "#3B82F6", // warp
  "#8B5CF6", // weft
  "#14B8A6", // covering
  "#F59E0B", // rubber
  "#EF4444", // chemicals
  "#10B981",
  "#EC4899",
  "#6B7280",
];

const kindTone: Record<MaterialGroupKind, "info" | "success" | "neutral"> = {
  position: "info",
  material: "success",
  other: "neutral",
};

function GroupForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: MaterialGroup;
  onSubmit: (v: MaterialGroupFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [values, setValues] = useState<MaterialGroupFormValues>(
    initial
      ? {
          name: initial.name,
          kind: initial.kind,
          sortOrder: initial.sortOrder,
          colour: initial.colour,
          defaultUnit: initial.defaultUnit,
          defaultMinStock: initial.defaultMinStock,
          notes: initial.notes,
        }
      : emptyGroupForm
  );

  const set = <K extends keyof MaterialGroupFormValues>(
    k: K,
    v: MaterialGroupFormValues[K]
  ) => setValues((p) => ({ ...p, [k]: v }));

  const renaming = !!initial && values.name.trim() !== initial.name;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...values, name: values.name.trim() });
      }}
      noValidate
    >
      <Input
        label="Group name *"
        value={values.name}
        onChange={(e) => set("name", e.target.value)}
        placeholder="Warp yarn"
        autoFocus
      />

      {/*
        Renaming a group rewrites the category on every material in it.
        That is correct — it is what keeps the two from drifting — but
        it is a lot to do silently, so it is said before it happens.
      */}
      {renaming && (
        <p className="flex items-start gap-2 rounded-md bg-status-warningBg px-3 py-2 text-xs text-status-warning">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Renaming this group also renames the category on every material in it
            {typeof initial?.materialCount === "number" && initial.materialCount > 0
              ? ` — ${initial.materialCount} material${initial.materialCount === 1 ? "" : "s"}.`
              : "."}
          </span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="What this group says"
          value={values.kind}
          onChange={(e) => set("kind", e.target.value as MaterialGroupKind)}
          options={GROUP_KINDS.map((k) => ({
            value: k.value,
            label: `${k.label} — ${k.hint}`,
          }))}
        />
        <Input
          label="Order in the list"
          type="number"
          value={values.sortOrder}
          onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
        />
      </div>

      <fieldset className="rounded-md border border-ink-200 p-3">
        <legend className="px-1 text-xs font-medium text-ink-500">
          Defaults for new materials
        </legend>
        {/*
          Copied onto a material when it is created, not read through at
          display time. Changing them here never restates a material that
          already exists — otherwise editing a default would silently
          rewrite the minimum stock of everything in the group.
        */}
        <p className="mb-3 text-xs text-ink-400">
          Filled in when a material is added to this group. Changing them here
          leaves existing materials exactly as they are.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Unit"
            value={values.defaultUnit}
            onChange={(e) => set("defaultUnit", e.target.value)}
            placeholder="kg"
          />
          <Input
            label="Min stock"
            type="number"
            value={values.defaultMinStock}
            onChange={(e) => set("defaultMinStock", Number(e.target.value) || 0)}
          />
        </div>
      </fieldset>

      {/*
        The chip colour, used by the material list here and by the
        category chips on the phone. Left blank, both fall back to the
        colours those screens have always drawn — so a group with no
        colour chosen looks exactly as it did before, rather than
        suddenly going grey.
      */}
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink-600">Chip colour</span>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Use ${hex}`}
              aria-pressed={values.colour.toLowerCase() === hex.toLowerCase()}
              onClick={() => set("colour", hex)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                values.colour.toLowerCase() === hex.toLowerCase()
                  ? "border-ink-900 scale-110"
                  : "border-ink-200 hover:scale-105"
              )}
              style={{ background: hex }}
            />
          ))}
          <button
            type="button"
            onClick={() => set("colour", "")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              values.colour
                ? "border-ink-200 text-ink-500 hover:border-ink-400"
                : "border-ink-900 font-medium text-ink-900"
            )}
          >
            Default
          </button>
        </div>
      </div>

      <Input
        label="Notes"
        value={values.notes}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Optional"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !values.name.trim()}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create group"}
        </Button>
      </div>
    </form>
  );
}

export function MaterialGroupsPage() {
  const toast = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MaterialGroup | null>(null);
  const [removing, setRemoving] = useState<MaterialGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMaterialGroups({ includeArchived: showArchived, withCounts: true });
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const remove = useRemoveGroup();
  const restore = useRestoreGroup();

  const rows = groups.data ?? [];
  const ungroupedHint = useMemo(
    () => rows.length === 0 && !groups.isLoading,
    [rows.length, groups.isLoading]
  );

  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");

  const columns: Column<MaterialGroup>[] = [
    {
      key: "name",
      header: "Group",
      render: (g) => (
        <div className="flex items-center gap-2">
          {g.colour && (
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-ink-200"
              style={{ background: g.colour }}
              aria-hidden="true"
            />
          )}
          <div>
            <p className="font-medium">
              {g.name}
              {g.archived && (
                <StatusChip tone="warning" className="ml-2">
                  Archived
                </StatusChip>
              )}
            </p>
            {/* The handle that does NOT move when the name is edited. */}
            <p className="font-mono text-xs text-ink-400">{g.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "kind",
      header: "Says",
      render: (g) => <StatusChip tone={kindTone[g.kind]}>{kindLabel[g.kind]}</StatusChip>,
    },
    {
      key: "count",
      header: "Materials",
      render: (g) => (
        <span className="tabular-nums">{g.materialCount ?? "—"}</span>
      ),
    },
    {
      key: "defaults",
      header: "New-material defaults",
      render: (g) => (
        <span className="text-xs text-ink-500">
          {g.defaultUnit || "kg"}
          {g.defaultMinStock > 0 ? ` · min ${g.defaultMinStock}` : ""}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (g) => (
        <div className="flex justify-end gap-1">
          {g.archived ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                restore
                  .mutateAsync(g._id)
                  .then(() => toast.success(`"${g.name}" is back in the pickers`))
                  .catch(fail)
              }
            >
              <RotateCcw className="h-4 w-4" /> Restore
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRemoving(g)}>
                {g.materialCount && g.materialCount > 0 ? (
                  <Archive className="h-4 w-4" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Material groups"
        subtitle="The categories raw materials are filed under. Used by the material form, the MRP sheet, stock counts and the phone."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New group
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="mb-4">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {/*
            Archived groups are out of the pickers — that is the point of
            archiving one — but they have to stay reachable, or a group
            archived by mistake can never be found to restore.
          */}
          Show archived
        </label>
      </div>

      <Card>
        {ungroupedHint ? (
          <EmptyState
            title="No groups yet"
            description="Add the categories you file yarn under — warp, weft, covering, rubber, chemicals. Existing materials keep working either way."
            action={<Button onClick={() => setCreating(true)}>Create the first group</Button>}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={groups.isLoading}
            rowKey={(g) => g._id}
          />
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New material group"
      >
        <GroupForm
          saving={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(v) =>
            create
              .mutateAsync(v)
              .then(() => {
                toast.success(`"${v.name}" added`);
                setCreating(false);
              })
              .catch(fail)
          }
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit group">
        {editing && (
          <GroupForm
            initial={editing}
            saving={update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(v) =>
              update
                .mutateAsync({ id: editing._id, values: v })
                .then((r) => {
                  // Say how many materials moved. A rename rewriting
                  // eighty rows without a word is a surprise.
                  toast.success(
                    r.materialsRenamed > 0
                      ? `Saved — ${r.materialsRenamed} material${
                          r.materialsRenamed === 1 ? "" : "s"
                        } renamed to "${v.name}"`
                      : "Saved"
                  );
                  setEditing(null);
                })
                .catch(fail)
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        title={
          removing?.materialCount && removing.materialCount > 0
            ? `Archive "${removing?.name}"?`
            : `Delete "${removing?.name}"?`
        }
        // The rule the three masters already follow: a group in use is
        // archived so every material still reads correctly; one nothing
        // has ever used is a typo and is simply removed.
        message={
          removing?.materialCount && removing.materialCount > 0
            ? `It holds ${removing.materialCount} material${
                removing.materialCount === 1 ? "" : "s"
              }, so it will be archived rather than deleted — out of the pickers, with every material still reading correctly.`
            : "Nothing is using this group, so it will be removed outright."
        }
        confirmLabel={
          removing?.materialCount && removing.materialCount > 0 ? "Archive" : "Delete"
        }
        danger={!removing?.materialCount}
        loading={remove.isPending}
        onConfirm={() =>
          remove
            .mutateAsync(removing!._id)
            .then((r) => {
              toast.success(r.message);
              setRemoving(null);
            })
            .catch(fail)
        }
      />
    </div>
  );
}

export default MaterialGroupsPage;
