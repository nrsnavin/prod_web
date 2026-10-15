import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { StatusChip } from "@/components/ui/StatusChip";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/core/http/httpClient";
import { useElasticGroups } from "@/features/elasticGroups/hooks";
import { itemElasticId } from "@/features/elasticGroups/types";
import { useElastics, useElasticMutations } from "./hooks";
import { elasticService } from "./api";
import { Elastic } from "./types";
import { ElasticForm } from "./ElasticForm";
import { ElasticBulkActions, freeStock } from "./ElasticBulkActions";

const columns: Column<Elastic>[] = [
  {
    key: "name",
    header: "Elastic",
    render: (e) => (
      <div>
        <p className="font-medium">
          {e.name}
          {e.archived && <StatusChip tone="warning" className="ml-2">Inactive</StatusChip>}
        </p>
        <p className="text-xs text-ink-400">{e.weaveType || "—"}</p>
      </div>
    ),
  },
  { key: "hooks", header: "Hooks", align: "right", render: (e) => e.noOfHook ?? "—" },
  { key: "pick", header: "Pick", align: "right", render: (e) => e.pick ?? "—" },
  {
    key: "weight",
    header: "Weight (g/m)",
    align: "right",
    render: (e) => e.weight?.toLocaleString("en-IN") ?? "—",
  },
  {
    key: "stock",
    header: "Stock (m)",
    align: "right",
    // Real stock position (was quantityProduced — a lifetime counter,
    // not what's on the shelf). LOW flags FREE stock (on the shelf less
    // what approved orders hold) at/under minStock — the same test as the
    // "Low stock only" filter, so a LOW row is always on that list.
    render: (e) => {
      const stock = e.stock ?? 0;
      const free = freeStock(e);
      const low = (e.minStock ?? 0) > 0 && free <= (e.minStock ?? 0);
      return (
        <span className="tabular-nums">
          {stock.toLocaleString("en-IN")}
          {low && <StatusChip tone="danger" className="ml-2">LOW</StatusChip>}
          {(e.reservedStock ?? 0) > 0 && (
            <span className="block text-xs text-ink-400">{free.toLocaleString("en-IN")} free</span>
          )}
        </span>
      );
    },
  },
];

export function ElasticListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [lowStock, setLowStock] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useElastics({ page, search, showInactive, lowStock });
  const { create } = useElasticMutations();

  // Ticked elastics, kept with their rows so a selection survives paging
  // and searching (and the bar can say which are inactive).
  const [picked, setPicked] = useState<Map<string, Elastic>>(new Map());
  const pickedIds = useMemo(() => new Set(picked.keys()), [picked]);
  const onPick = (next: Set<string>) => {
    const onPage = new Map((data?.elastics ?? []).map((e) => [e._id, e]));
    setPicked((prev) => {
      const m = new Map<string, Elastic>();
      for (const id of next) {
        const row = onPage.get(id) ?? prev.get(id);
        if (row) m.set(id, row);
      }
      return m;
    });
  };

  // A group is also a saved selection — a customer's usual elastics. Picking
  // one ticks its elastics (adding to what is ticked), ready for New order,
  // a quotation or a price list.
  const groups = useElasticGroups();
  const [groupBusy, setGroupBusy] = useState(false);
  const selectGroup = async (groupId: string) => {
    const group = groups.data?.find((g) => g._id === groupId);
    if (!group) return;
    const ids = group.items.map(itemElasticId).filter(Boolean);
    if (!ids.length) return toast(`"${group.name}" has no elastics`, "info");
    setGroupBusy(true);
    try {
      const r = await elasticService.list({ ids: ids.join(","), includeArchived: "true", limit: 200 });
      setPicked((prev) => {
        const m = new Map(prev);
        for (const e of r.elastics) m.set(e._id, e);
        return m;
      });
      toast(`Selected ${r.elastics.length} from "${group.name}"`, "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not load the group", "error");
    } finally {
      setGroupBusy(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <>
      <PageHeader
        title="Elastic products"
        subtitle={data ? `${data.total} products` : undefined}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New elastic
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search elastics…"
          className="max-w-sm"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-ink-300 accent-brand-500"
          />
          Show inactive
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => {
              setLowStock(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-ink-300 accent-brand-500"
          />
          Low stock only
        </label>
        {(groups.data?.length ?? 0) > 0 && (
          <div className="w-56">
            <Select
              aria-label="Select from a group"
              placeholder={groupBusy ? "Selecting…" : "Select from a group…"}
              disabled={groupBusy}
              options={(groups.data ?? []).map((g) => ({
                value: g._id,
                label: `${g.name}${g.customer?.name ? ` — ${g.customer.name}` : ""} (${g.items.length})`,
              }))}
              value=""
              onChange={(e) => selectGroup(e.target.value)}
            />
          </div>
        )}
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {picked.size > 0 && (
        <ElasticBulkActions selected={[...picked.values()]} onClear={() => setPicked(new Map())} />
      )}

      <Card>
        <DataTable
          selection={{ selected: pickedIds, onChange: onPick, label: (e) => `Select ${e.name}` }}
          columns={columns}
          rows={data?.elastics ?? []}
          rowKey={(e) => e._id}
          onRowClick={(e) => navigate(`/elastics/${e._id}`)}
          loading={isLoading}
          emptyTitle={lowStock ? "Nothing is low on stock" : "No elastic products"}
          emptyDescription={
            lowStock
              ? "No elastic's free stock is at or under its min stock."
              : "Create your first elastic definition with its material composition."
          }
        />
        <Pagination page={page} totalPages={totalPages} total={data?.total} onChange={setPage} />
      </Card>

      <FormScreen open={createOpen} onClose={() => setCreateOpen(false)} title="New elastic" width="max-w-2xl">
        <ElasticForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Elastic created", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to create elastic", "error"),
            })
          }
        />
      </FormScreen>
    </>
  );
}
