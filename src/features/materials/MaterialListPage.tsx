import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, TriangleAlert, ClipboardList, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterChips } from "@/components/ui/FilterChips";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useMaterials, useMaterialMutations } from "./hooks";
import { MATERIAL_CATEGORIES, RawMaterial } from "./types";
import { MaterialForm } from "./MaterialForm";
import { ReorderSuggestions, StockTakeModal } from "./StockOps";

const columns: Column<RawMaterial>[] = [
  {
    key: "name",
    header: "Material",
    render: (m) => (
      <div className="flex items-center gap-2">
        {m.stock <= m.minStock && <TriangleAlert className="h-4 w-4 text-status-danger shrink-0" />}
        <div>
          <p className="font-medium">{m.name}</p>
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
    render: (m) => <StatusChip tone="neutral">{m.category}</StatusChip>,
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
  { key: "price", header: "Price (₹)", align: "right", sort: (m) => m.price, render: (m) => m.price.toLocaleString("en-IN") },
  {
    key: "consumption",
    header: "Consumed",
    align: "right",
    render: (m) => (m.totalConsumption ?? 0).toLocaleString("en-IN"),
  },
];

export function MaterialListPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lowStock, setLowStock] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [stockTakeOpen, setStockTakeOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useMaterials({ search, category, lowStock });
  const { create } = useMaterialMutations();

  const stockValue = (data ?? []).reduce((s, m) => s + m.stock * (m.price || 0), 0);

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
            <Button variant="secondary" onClick={() => navigate("/materials/forecast")}>
              <TrendingDown className="h-4 w-4" /> Reorder forecast
            </Button>
            <Button variant="secondary" onClick={() => setStockTakeOpen(true)}>
              <ClipboardList className="h-4 w-4" /> Stock take
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
          options={[{ value: "all", label: "All" }, ...MATERIAL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
          value={category}
          onChange={setCategory}
        />
        <button
          onClick={() => setLowStock((v) => !v)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors inline-flex items-center gap-1.5",
            lowStock
              ? "bg-status-dangerBg border-status-danger text-status-danger"
              : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"
          )}
        >
          <TriangleAlert className="h-3.5 w-3.5" /> Low stock only
        </button>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add raw material">
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
      </Modal>
    </>
  );
}
