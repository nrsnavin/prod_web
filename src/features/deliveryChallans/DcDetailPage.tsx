import { useState } from "react";
import { TableScroll } from "@/components/ui/TableScroll";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, Truck, PackageCheck, XCircle, FileDown, Pencil } from "lucide-react";
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
import { DcEditModal } from "./DcEditModal";
import { CompanyLetterhead, CompanyDocumentFooter } from "@/components/documents/CompanyLetterhead";

export function DcDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: dc, isLoading, isError, error } = useDc(id);
  const { updateStatus } = useDcMutations();
  const [downloading, setDownloading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
              {/* Print the SAME document that downloads — the server PDF
                  built from the Settings → PDF Designer template. Printing
                  the on-page HTML produced a different-looking challan. */}
              <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              {/* Delivered and cancelled challans are not editable — the
                  customer holds the one, and the other's stock has already
                  gone back. The server refuses both by name; the button is
                  hidden so it is not offered and then taken away. */}
              {(dc.status === "draft" || dc.status === "dispatched") && (
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
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
          {/* Company block comes from Settings → Document settings, the
              same source the generated PDF uses. */}
          <CompanyLetterhead
            docTitle="DELIVERY CHALLAN"
            docSubtitle={`${dc.type === "elastic" ? "Finished goods" : "Machine parts"} · Not a tax invoice`}
          />
          <div className="flex justify-end pt-3 text-sm">
            <div className="text-right">
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

          {/* A challan accompanies goods; it is not a tax invoice, so it
              carries no rate, amount or value. Ruled on every side to match
              the generated PDF, which is the copy that travels. */}
          <TableScroll>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-ink-100 text-xs uppercase tracking-wide text-ink-900">
                  <th className="border border-ink-300 px-2 py-1.5 text-left font-semibold">S.No</th>
                  <th className="border border-ink-300 px-2 py-1.5 text-left font-semibold">
                    Description of Goods
                  </th>
                  <th className="border border-ink-300 px-2 py-1.5 text-center font-semibold">UOM</th>
                  <th className="border border-ink-300 px-2 py-1.5 text-right font-semibold">Quantity</th>
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
                      <td className="border border-ink-300 px-2 py-1.5 tabular-nums">{i + 1}</td>
                      <td className="border border-ink-300 px-2 py-1.5">{name}</td>
                      <td className="border border-ink-300 px-2 py-1.5 text-center">
                        {item.unit || "m"}
                      </td>
                      <td className="border border-ink-300 px-2 py-1.5 text-right tabular-nums">
                        {item.quantity.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="border border-ink-300 px-2 py-1.5" colSpan={2}>
                    Total line items: {(dc.items ?? []).length}
                  </td>
                  <td className="border border-ink-300 px-2 py-1.5 text-right text-xs uppercase tracking-wide text-ink-600">
                    Total qty
                  </td>
                  <td className="border border-ink-300 px-2 py-1.5 text-right tabular-nums">
                    {(dc.totalQuantity ?? 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableScroll>

          {dc.remarks && (
            <p className="mt-4 text-sm text-ink-600">
              <span className="font-medium">Remarks:</span> {dc.remarks}
            </p>
          )}

          <div className="mt-10 grid grid-cols-3 border border-ink-300 text-xs text-ink-600">
            <div className="border-r border-ink-300 px-2 pb-2 pt-10">Prepared by</div>
            <div className="border-r border-ink-300 px-2 pb-2 pt-10">Checked by</div>
            <div className="px-2 pb-2 pt-10">Receiver&apos;s signature &amp; seal</div>
          </div>

          <CompanyDocumentFooter />
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

      {/* Keyed on the challan's own figures so reopening after a save
          starts from what was stored, not the state it was left in. */}
      {editOpen && (
        <DcEditModal
          key={`${dc._id}-${dc.totalQuantity}-${(dc.items ?? []).length}`}
          dc={dc}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
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
