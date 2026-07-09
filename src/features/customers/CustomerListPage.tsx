import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useCustomers, useCustomerMutations } from "./hooks";
import { Customer } from "./types";
import { CustomerForm } from "./CustomerForm";

const columns: Column<Customer>[] = [
  {
    key: "name",
    header: "Customer",
    render: (c) => (
      <div>
        <p className="font-medium">{c.name}</p>
        <p className="text-xs text-ink-400">{c.contactName || "—"}</p>
      </div>
    ),
  },
  { key: "phone", header: "Phone", render: (c) => c.phoneNumber || "—" },
  { key: "gstin", header: "GSTIN", render: (c) => c.gstin || "—" },
  { key: "terms", header: "Payment terms", render: (c) => c.paymentTerms || "—" },
  {
    key: "status",
    header: "Status",
    render: (c) => (
      <StatusChip tone={c.status === "Inactive" ? "neutral" : "success"}>
        {c.status || "Active"}
      </StatusChip>
    ),
  },
];

export function CustomerListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useCustomers({ page, search });
  const { create } = useCustomerMutations();

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={data ? `${data.total} customers` : undefined}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add customer
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
          placeholder="Search name, phone or GSTIN…"
          className="max-w-sm"
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.customers ?? []}
          rowKey={(c) => c._id}
          onRowClick={(c) => navigate(`/customers/${c._id}`)}
          loading={isLoading}
          emptyTitle="No customers found"
          emptyDescription={search ? "Try a different search." : "Add your first customer to get started."}
        />
        <Pagination page={page} totalPages={data?.pages ?? 1} total={data?.total} onChange={setPage} />
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add customer">
        <CustomerForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Customer added", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to add customer", "error"),
            })
          }
        />
      </Modal>
    </>
  );
}
