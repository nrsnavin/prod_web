import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, UserCheck, UserX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
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
import { CustomerOrdersCard } from "./CustomerOrdersCard";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: customer, isLoading, isError, error } = useCustomer(id);
  const { update, setArchived } = useCustomerMutations();
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
            {/* Archiving is reversible, so restoring is offered in the
                same place rather than needing the archived list. */}
            {customer.archived ? (
              <Button
                variant="secondary"
                loading={setArchived.isPending}
                onClick={() =>
                  setArchived.mutate(
                    { id: customer._id, archived: false },
                    {
                      onSuccess: () => toast(`${customer.name} restored`, "success"),
                      onError: (e) =>
                        toast(e instanceof ApiError ? e.message : "Failed to restore", "error"),
                    }
                  )
                }
              >
                <UserCheck className="h-4 w-4" /> Restore
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                <UserX className="h-4 w-4" /> Archive
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

      <CustomerOrdersCard customerId={customer._id} />

      <CustomerElasticGroups customerId={customer._id} />

      <FormScreen open={editOpen} onClose={() => setEditOpen(false)} title="Edit customer">
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
      </FormScreen>

      <ConfirmDialog
        open={confirmOpen}
        title="Archive customer?"
        message={`${customer.name} will be hidden from lists and pickers. Nothing is deleted — their orders, challans and history keep their references, and they can be restored at any time. A customer with open orders cannot be archived.`}
        confirmLabel="Archive"
        danger
        loading={setArchived.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() =>
          setArchived.mutate(
            { id: customer._id, archived: true },
            {
              onSuccess: () => {
                setConfirmOpen(false);
                toast(`${customer.name} archived`, "success");
                navigate("/customers");
              },
              // The refusal names the open orders, so it is worth showing.
              onError: (e) => {
                setConfirmOpen(false);
                toast(e instanceof ApiError ? e.message : "Failed to archive", "error");
              },
            }
          )
        }
      />
    </>
  );
}
