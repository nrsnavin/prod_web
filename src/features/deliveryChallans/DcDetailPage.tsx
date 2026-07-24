import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, Truck, PackageCheck, XCircle, FileDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useDc, useDcMutations } from "./hooks";
import { dcService } from "./api";
import { DcStatus } from "./types";
import { dcStatusTone } from "./DcListPage";

export function DcDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: dc, isLoading, isError, error } = useDc(id);
  const { updateStatus } = useDcMutations();
  const [downloading, setDownloading] = useState(false);
  // Status transition awaiting confirmation.
  const [pending, setPending] = useState<
    { status: DcStatus; msg: string; title: string; body: string; label: string; danger?: boolean } | null
  >(null);

  const downloadPdf = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const blob = await dcService.pdfBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Revoke a little later so the new tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not generate the PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (isError || !dc) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Delivery challan not found"}
      </p>
    );
  }

  const setStatus = (status: DcStatus, msg: string) =>
    updateStatus.mutate(
      { id: dc._id, status },
      {
        onSuccess: () => toast(msg, "success"),
        onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
      }
    );

  const orderNo =
    dc.orderNo ?? (typeof dc.order === "object" && dc.order ? dc.order.orderNo : undefined);

  return (
    <>
      <div className="print:hidden">
        <Link
          to="/delivery-challans"
          className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Delivery challans
        </Link>
        <PageHeader
          title={dc.dcNumber}
          subtitle={dc.customerName}
          actions={
            <>
              <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
                <FileDown className="h-4 w-4" /> Download PDF
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              {dc.status === "draft" && (
                <Button loading={updateStatus.isPending} onClick={() => setPending({
                  status: "dispatched", msg: "DC dispatched", label: "Dispatch",
                  title: "Dispatch this challan?",
                  body: "Mark this delivery challan as dispatched? This confirms the goods have left the premises.",
                })}>
                  <Truck className="h-4 w-4" /> Dispatch
                </Button>
              )}
              {dc.status === "dispatched" && (
                <Button loading={updateStatus.isPending} onClick={() => setPending({
                  status: "delivered", msg: "DC delivered", label: "Mark delivered",
                  title: "Mark as delivered?",
                  body: "Confirm the customer has received this delivery.",
                })}>
                  <PackageCheck className="h-4 w-4" /> Mark delivered
                </Button>
              )}
              {(dc.status === "draft" || dc.status === "dispatched") && (
                <Button
                  variant="danger"
                  loading={updateStatus.isPending}
                  onClick={() => setPending({
                    status: "cancelled", msg: "DC cancelled — stock restored", label: "Cancel DC", danger: true,
                    title: "Cancel this challan?",
                    body: "Cancelling restores the deducted stock and reservations. This can't be undone.",
                  })}
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </Button>
              )}
            </>
          }
        />
        <div className="mb-4">
          <StatusChip tone={dcStatusTone[dc.status]}>{dc.status}</StatusChip>
        </div>
      </div>

      {/* Printable challan document */}
      <div className="print-area">
        <Card className="p-8 max-w-3xl print:shadow-none print:p-0 print:max-w-none">
          <div className="flex items-start justify-between border-b border-ink-200 pb-4">
            <div>
              <h1 className="text-xl font-bold">DELIVERY CHALLAN</h1>
              <p className="text-sm text-ink-600 mt-0.5">
                {dc.type === "elastic" ? "Finished goods" : "Machine parts"} · Not a tax invoice
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-bold">{dc.dcNumber}</p>
              <p className="text-ink-600">
                {dc.dispatchDate ? new Date(dc.dispatchDate).toLocaleDateString() : ""}
              </p>
              {orderNo && <p className="text-ink-600">Against order #{orderNo}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">
                Consignee
              </p>
              <p className="font-semibold">{dc.customerName}</p>
              {dc.customerAddress && <p className="text-ink-600">{dc.customerAddress}</p>}
              {dc.customerPhone && <p className="text-ink-600">Ph: {dc.customerPhone}</p>}
              {dc.customerGstin && <p className="text-ink-600">GSTIN: {dc.customerGstin}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">
                Transport
              </p>
              <p className="text-ink-600">Vehicle: {dc.vehicleNo || "—"}</p>
              <p className="text-ink-600">Driver: {dc.driverName || "—"}</p>
              <p className="text-ink-600">Transporter: {dc.transporter || "—"}</p>
              <p className="text-ink-600">LR no: {dc.lrNumber || "—"}</p>
            </div>
          </div>

          <table className="w-full text-sm border-t border-ink-200">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 text-left">#</th>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate (₹)</th>
                <th className="py-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(dc.items ?? []).map((item, i) => {
                const name =
                  item.elasticName ||
                  (typeof item.elastic === "object" && item.elastic ? item.elastic.name : "") ||
                  item.description ||
                  "—";
                return (
                  <tr key={item._id ?? i}>
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2 font-medium">{name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {item.quantity.toLocaleString("en-IN")} {item.unit || "m"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{item.rate.toLocaleString("en-IN")}</td>
                    <td className="py-2 text-right tabular-nums">
                      {(item.amount ?? item.quantity * item.rate).toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-200 font-semibold">
                <td className="py-2" colSpan={2}>Total</td>
                <td className="py-2 text-right tabular-nums">
                  {(dc.totalQuantity ?? 0).toLocaleString("en-IN")}
                </td>
                <td />
                <td className="py-2 text-right tabular-nums">
                  ₹{(dc.totalAmount ?? 0).toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          </table>

          {dc.remarks && (
            <p className="mt-4 text-sm text-ink-600">
              <span className="font-medium">Remarks:</span> {dc.remarks}
            </p>
          )}

          <div className="mt-12 grid grid-cols-2 gap-6 text-sm text-ink-600">
            <div className="border-t border-ink-200 pt-2">Receiver's signature</div>
            <div className="border-t border-ink-200 pt-2 text-right">Authorised signatory</div>
          </div>
        </Card>
      </div>

      {dc.status === "cancelled" && (
        <p className="mt-4 text-sm text-ink-400 print:hidden">
          This DC is cancelled — deducted stock and reservations were restored.{" "}
          <button className="text-brand-600 hover:underline" onClick={() => navigate("/delivery-challans")}>
            Back to list
          </button>
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        message={pending?.body ?? ""}
        confirmLabel={pending?.label ?? "Confirm"}
        danger={pending?.danger}
        loading={updateStatus.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) setStatus(pending.status, pending.msg);
          setPending(null);
        }}
      />
    </>
  );
}
