import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, TriangleAlert, ClipboardList, TrendingDown, IndianRupee, Layers } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useMaterials, useMaterialMutations } from "./hooks";
import { RawMaterial } from "./types";
import { useMaterialGroups } from "../materialGroups/hooks";
import { MaterialForm } from "./MaterialForm";
import { ReorderSuggestions, StockTakeModal, BulkPriceUpdateModal } from "./StockOps";

const columns: Column<RawMaterial>[] = [
  {
    key: "name",
    header: "Material",
    render: (m) => (
      <div className="flex items-center gap-2">
        {m.stock <= m.minStock && <TriangleAlert className="h-4 w-4 text-status-danger shrink-0" />}
        <div>
          <p className="font-medium">
            {m.name}
            {m.archived && (
              <StatusChip tone="warning" className="ml-2">Archived</StatusChip>
            )}
          </p>
          <p className="text-xs text-ink-400">
            {typeof m.supplier === "object" && m.supplier ? m.supplier.name : "—"}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "cat",
    header: "Category",
    render: (m) => {
      const colour =
        m.group && typeof m.group === "object" ? m.group.colour : undefined;
      return (
        <StatusChip tone="neutral">
          <span className="inline-flex items-center gap-1.5">
            {/* The group's own colour, when Settings has one. */}
            {colour && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: colour }}
                aria-hidden="true"
              />
            )}
            {m.category}
            {/*
              A material whose category no group carries — anything
              created before the migration, or by a client that has not
              been updated. Worth marking: it is invisible to a group
              filter and to any report that subtotals by group.
            */}
            {!m.group && <span className="text-ink-400">· ungrouped</span>}
          </span>
        </StatusChip>
      );
    },
  },
  {
    key: "stock",
    header: "Stock",
    align: "right",
    sort: (m) => m.stock,
    render: (m) => (
      <span className={cn("font-semibold", m.stock <= m.minStock && "text-status-danger")}>
        {m.stock.toLocaleString("en-IN")}
      </span>
    ),
  },
  { key: "min", header: "Min stock", align: "right", sort: (m) => m.minStock, render: (m) => m.minStock.toLocaleString("en-IN") },
  {
    key: "price",
    header: "Price (₹)",
    align: "right",
    sort: (m) => m.price,
    render: (m) => m.price.toLocaleString("en-IN"),
  },
  {
    // What the stock on hand cost, as against what the next kilo will.
    // They are different numbers on a moving market and the second one
    // is not what consumption should be valued at.
    key: "avgCost",
    header: "Avg cost (₹)",
    align: "right",
    sort: (m) => m.avgCost || m.price,
    render: (m) => (
      <span className={m.avgCost ? undefined : "text-ink-400"}>
        {(m.avgCost || m.price).toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    key: "value",
    header: "Value (₹)",
    align: "right",
    sort: (m) => m.stock * (m.avgCost || m.price),
    render: (m) =>
      Math.round(m.stock * (m.avgCost || m.price)).toLocaleString("en-IN"),
  },
  {
    key: "consumption",
    header: "Consumed",
    align: "right",
    render: (m) => (m.totalConsumption ?? 0).toLocaleString("en-IN"),
  },
];

export function MaterialListPage() {
  const [search, setSearch] = useState("");
  // Holds a MaterialGroup id, or "all". The chips used to hold the four
  // hardcoded strings, which is why "Chemicals" — a category the phone
  // has always offered — had no chip at all.
  const [category, setCategory] = useState("all");
  const [lowStock, setLowStock] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const groups = useMaterialGroups();
  const [stockTakeOpen, setStockTakeOpen] = useState(false);
  const [priceUpdateOpen, setPriceUpdateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useMaterials({
    search, group: category, lowStock, includeArchived: showArchived,
  });
  const { create } = useMaterialMutations();

  const stockValue = (data ?? []).reduce(
    (s, m) => s + m.stock * (m.avgCost || m.price || 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Raw materials"
        subtitle={
          data
            ? `${data.length} materials · stock value ≈ ₹${Math.round(stockValue).toLocaleString("en-IN")}`
            : undefined
        }
        actions={
          <>
            {/*
              Reachable from the screen it governs. A settings page with
              no link from anywhere is a page nobody finds — /quotes
              shipped that way and had to be rescued.
            */}
            <Button variant="secondary" onClick={() => navigate("/materials/groups")}>
              <Layers className="h-4 w-4" /> Groups
            </Button>
            <Button variant="secondary" onClick={() => navigate("/materials/forecast")}>
              <TrendingDown className="h-4 w-4" /> Reorder forecast
            </Button>
            <Button variant="secondary" onClick={() => setStockTakeOpen(true)}>
              <ClipboardList className="h-4 w-4" /> Stock take
            </Button>
            <Button variant="secondary" onClick={() => setPriceUpdateOpen(true)}>
              <IndianRupee className="h-4 w-4" /> Update prices
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add material
            </Button>
          </>
        }
      />

      <ReorderSuggestions />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search materials…" className="w-full max-w-sm" />
        <FilterChips
          options={[
            { value: "all", label: "All" },
            ...(groups.data ?? []).map((g) => ({ value: g._id, label: g.name })),
          ]}
          value={category}
          onChange={setCategory}
        />
        <button
          onClick={() => setLowStock((v) => !v)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-1.5",
            lowStock
              ? "bg-status-dangerBg border-status-danger text-status-danger"
              : "bg-surface border-ink-200 text-ink-600 hover:border-ink-400"
          )}
        >
          <TriangleAlert className="h-3.5 w-3.5" /> Low stock only
        </button>
        {/*
          Archived materials are out of the pickers — that is the point
          of archiving one — but they have to stay reachable, or a yarn
          that was archived by mistake can never be found to restore.
        */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 accent-brand-500"
          />
          Show archived
        </label>
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(m) => m._id}
          onRowClick={(m) => navigate(`/materials/${m._id}`)}
          loading={isLoading}
          emptyTitle="No materials found"
        />
      </Card>

      {stockTakeOpen && data && (
        <StockTakeModal materials={data} onClose={() => setStockTakeOpen(false)} />
      )}

      {priceUpdateOpen && data && (
        <BulkPriceUpdateModal materials={data} onClose={() => setPriceUpdateOpen(false)} />
      )}

      <FormScreen open={createOpen} onClose={() => setCreateOpen(false)} title="Add raw material">
        <MaterialForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Material added", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to add material", "error"),
            })
          }
        />
      </FormScreen>
    </>
  );
}
