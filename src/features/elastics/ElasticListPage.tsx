import { useState } from "react";
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
import { ApiError } from "@/core/http/httpClient";
import { useElastics, useElasticMutations } from "./hooks";
import { Elastic } from "./types";
import { ElasticForm } from "./ElasticForm";

const columns: Column<Elastic>[] = [
  {
    key: "name",
    header: "Elastic",
    render: (e) => (
      <div>
        <p className="font-medium">{e.name}</p>
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
    render: (e) => (e.quantityProduced ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "cost",
    header: "Cost (₹/m)",
    align: "right",
    render: (e) =>
      e.costing?.totalCost != null ? e.costing.totalCost.toLocaleString("en-IN") : "—",
  },
];

export function ElasticListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useElastics({ page, search });
  const { create } = useElasticMutations();

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

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search elastics…"
          className="max-w-sm"
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.elastics ?? []}
          rowKey={(e) => e._id}
          onRowClick={(e) => navigate(`/elastics/${e._id}`)}
          loading={isLoading}
          emptyTitle="No elastic products"
          emptyDescription="Create your first elastic definition with its material composition."
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
