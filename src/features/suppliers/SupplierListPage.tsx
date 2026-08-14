import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useSuppliers, useSupplierMutations } from "./hooks";
import { Supplier, SupplierFormValues } from "./types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().optional(),
  gstin: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  // Coerced, because a number input hands back a string. Without these
  // three in the schema the resolver strips them and the fields render,
  // accept typing, and submit nothing.
  leadTimeDays: z.coerce.number().min(0).optional(),
  minOrderQty: z.coerce.number().min(0).optional(),
  packSize: z.coerce.number().min(0).optional(),
});

function SupplierForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Supplier;
  submitting: boolean;
  onSubmit: (v: SupplierFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      phoneNumber: initial?.phoneNumber ?? "",
      gstin: initial?.gstin ?? "",
      email: initial?.email ?? "",
      address: initial?.address ?? "",
      contactPerson: initial?.contactPerson ?? "",
      leadTimeDays: initial?.leadTimeDays ?? 0,
      minOrderQty: initial?.minOrderQty ?? 0,
      packSize: initial?.packSize ?? 0,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Supplier name *" error={errors.name?.message} {...register("name")} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Contact person" {...register("contactPerson")} />
        <Input label="Phone" {...register("phoneNumber")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <Input label="GSTIN" {...register("gstin")} />
      </div>
      <Input label="Address" {...register("address")} />

      <fieldset className="rounded-md border border-ink-200 p-3">
        <legend className="px-1 text-xs font-medium text-ink-500">Replenishment terms</legend>
        {/*
          Lead time is what the reorder point is built on. Left at 0 the
          system falls back to what your own goods receipts have
          measured for this supplier — so this field is for when you
          know something the history does not, not a box that must be
          filled before anything works.
        */}
        <p className="mb-3 text-xs text-ink-400">
          Leave lead time at 0 to use what your goods receipts have measured for this
          supplier. Set it only when you know something the deliveries do not.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Lead time (days)" type="number" min={0} {...register("leadTimeDays")} />
          <Input label="Min order qty" type="number" min={0} {...register("minOrderQty")} />
          <Input label="Pack size" type="number" min={0} {...register("packSize")} />
        </div>
      </fieldset>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Add supplier"}
        </Button>
      </div>
    </form>
  );
}

export function SupplierListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const { data, isLoading, isError, error } = useSuppliers({ page, search });
  const { create, update, remove } = useSupplierMutations();

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      render: (s) => (
        <div>
          <p className="font-medium">{s.name}</p>
          <p className="text-xs text-ink-400">{s.contactPerson || "—"}</p>
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (s) => s.phoneNumber || "—" },
    { key: "email", header: "Email", render: (s) => s.email || "—" },
    { key: "gstin", header: "GSTIN", render: (s) => s.gstin || "—" },
    {
      key: "active",
      header: "Status",
      render: (s) => (
        <StatusChip tone={s.isActive === false ? "neutral" : "success"}>
          {s.isActive === false ? "Inactive" : "Active"}
        </StatusChip>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (s) => (
        <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
            onClick={() => {
              setEditing(s);
              setFormOpen(true);
            }}
            aria-label={`Edit ${s.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
            onClick={() => setDeleting(s)}
            aria-label={`Delete ${s.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle={data ? `${data.pagination.total} suppliers` : undefined}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add supplier
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
          placeholder="Search suppliers…"
          className="max-w-sm"
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      <Card>
        <DataTable
          columns={columns}
          rows={data?.suppliers ?? []}
          rowKey={(s) => s._id}
          onRowClick={(s) => navigate(`/suppliers/${s._id}`)}
          loading={isLoading}
          emptyTitle="No suppliers found"
        />
        <Pagination
          page={page}
          totalPages={data?.pagination.totalPages ?? 1}
          onChange={setPage}
        />
      </Card>

      <FormScreen
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit supplier" : "Add supplier"}
      >
        <SupplierForm
          initial={editing ?? undefined}
          submitting={create.isPending || update.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={(values) => {
            const opts = {
              onSuccess: () => {
                setFormOpen(false);
                toast(editing ? "Supplier updated" : "Supplier added", "success");
              },
              onError: (e: unknown) =>
                toast(e instanceof ApiError ? e.message : "Save failed", "error"),
            };
            if (editing) update.mutate({ id: editing._id, body: values }, opts);
            else create.mutate(values, opts);
          }}
        />
      </FormScreen>

      <ConfirmDialog
        open={!!deleting}
        title="Delete supplier?"
        message={`${deleting?.name ?? ""} will be deactivated.`}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting._id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Supplier deleted", "success");
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Delete failed", "error"),
          })
        }
      />
    </>
  );
}
