import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, ChevronRight, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTrackRecent } from "@/core/ui/uiStore";
import { supplierService, poService } from "./api";
import { poStatusTone } from "./PoListPage";
import { PurchaseOrder } from "./types";

function PoRow({ po }: { po: PurchaseOrder }) {
  const when = po.date ?? po.createdAt;
  return (
    <Link
      to={`/purchase-orders/${po._id}`}
      className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-ink-100/50"
    >
      <div className="min-w-0">
        <p className="font-medium text-sm">PO #{po.poNo}</p>
        <p className="text-xs text-ink-400">
          {(po.items?.length ?? 0)} item{(po.items?.length ?? 0) === 1 ? "" : "s"}
          {when ? ` · ${new Date(when).toLocaleDateString()}` : ""}
          {po.expectedDate ? ` · Expected ${new Date(po.expectedDate).toLocaleDateString()}` : ""}
        </p>
      </div>
      <span className="flex items-center gap-2 shrink-0">
        <StatusChip tone={poStatusTone[po.status] ?? "neutral"}>{po.status}</StatusChip>
        <ChevronRight className="h-4 w-4 text-ink-400" />
      </span>
    </Link>
  );
}

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const supplier = useQuery({
    queryKey: ["supplier", "detail", id],
    queryFn: () => supplierService.getById(id!),
    enabled: !!id,
  });
  const pos = useQuery({
    queryKey: ["supplier", "pos", id],
    queryFn: () => poService.list({ supplierId: id!, page: 1, limit: 50, status: "all" }),
    enabled: !!id,
  });

  useTrackRecent(
    "Supplier",
    `/suppliers/${id}`,
    supplier.data ? supplier.data.name : undefined
  );

  if (supplier.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (supplier.isError || !supplier.data) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(supplier.error as Error | null)?.message ?? "Supplier not found"}
      </p>
    );
  }

  const s = supplier.data;
  const poList = pos.data?.pos ?? [];

  return (
    <>
      <Link to="/suppliers" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Suppliers
      </Link>
      <PageHeader
        title={s.name}
        subtitle={s.contactPerson}
        actions={
          <Button onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="h-4 w-4" /> New PO
          </Button>
        }
      />

      <Card className="p-6">
        <div className="mb-4">
          <StatusChip tone={s.isActive === false ? "neutral" : "success"}>
            {s.isActive === false ? "Inactive" : "Active"}
          </StatusChip>
        </div>
        <DescriptionList
          columns={3}
          items={[
            { label: "Contact person", value: s.contactPerson },
            { label: "Phone", value: s.phoneNumber },
            { label: "Email", value: s.email },
            { label: "GSTIN", value: s.gstin },
            { label: "Address", value: s.address },
          ]}
        />
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-brand-500" /> Purchase orders
          {poList.length > 0 && (
            <span className="text-xs font-normal text-ink-400">({poList.length})</span>
          )}
        </h3>
        {pos.isLoading ? (
          <Skeleton className="mt-3 h-24 w-full" />
        ) : pos.isError ? (
          <p className="mt-3 text-sm text-ink-400">Could not load purchase orders.</p>
        ) : poList.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">No purchase orders for this supplier yet.</p>
        ) : (
          <div className="mt-2 divide-y divide-ink-100">
            {poList.map((po) => (
              <PoRow key={po._id} po={po} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
