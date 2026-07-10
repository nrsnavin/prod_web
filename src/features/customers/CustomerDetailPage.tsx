import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useCustomer, useCustomerMutations } from "./hooks";
import { CustomerForm } from "./CustomerForm";
import { useTrackRecent } from "@/core/ui/uiStore";
import { CustomerElasticGroups } from "@/features/elasticGroups/CustomerElasticGroups";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: customer, isLoading, isError, error } = useCustomer(id);
  const { update, deactivate } = useCustomerMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useTrackRecent("Customer", `/customers/${id}`, customer?.name);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !customer) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Customer not found"}
      </p>
    );
  }

  return (
    <>
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>
      <PageHeader
        title={customer.name}
        subtitle={customer.contactName}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {customer.status !== "Inactive" && (
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <UserX className="h-4 w-4" /> Deactivate
              </Button>
            )}
          </>
        }
      />

      <Card className="p-6">
        <div className="mb-4">
          <StatusChip tone={customer.status === "Inactive" ? "neutral" : "success"}>
            {customer.status || "Active"}
          </StatusChip>
        </div>
        <DescriptionList
          columns={3}
          items={[
            { label: "Contact person", value: customer.contactName },
            { label: "Phone", value: customer.phoneNumber },
            { label: "Email", value: customer.email },
            { label: "GSTIN", value: customer.gstin },
            { label: "Payment terms", value: customer.paymentTerms },
            {
              label: "Accountant",
              value: customer.accountant?.name
                ? `${customer.accountant.name}${customer.accountant.phoneNumber ? ` · ${customer.accountant.phoneNumber}` : ""}`
                : undefined,
            },
            {
              label: "Merchandiser",
              value: customer.merchandiser?.name
                ? `${customer.merchandiser.name}${customer.merchandiser.phoneNumber ? ` · ${customer.merchandiser.phoneNumber}` : ""}`
                : undefined,
            },
            {
              label: "Customer since",
              value: customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString()
                : undefined,
            },
          ]}
        />
      </Card>

      <CustomerElasticGroups customerId={customer._id} />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit customer">
        <CustomerForm
          initial={customer}
          submitting={update.isPending}
          onCancel={() => setEditOpen(false)}
          onSubmit={(values) =>
            update.mutate(
              { id: customer._id, body: values },
              {
                onSuccess: () => {
                  setEditOpen(false);
                  toast("Customer updated", "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Update failed", "error"),
              }
            )
          }
        />
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate customer?"
        message={`${customer.name} will be marked Inactive. Existing orders are unaffected.`}
        confirmLabel="Deactivate"
        danger
        loading={deactivate.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          deactivate.mutate(customer._id, {
            onSuccess: () => {
              setConfirmOpen(false);
              toast("Customer deactivated", "success");
              navigate("/customers");
            },
            onError: (e) =>
              toast(e instanceof ApiError ? e.message : "Failed to deactivate", "error"),
          })
        }
      />
    </>
  );
}
