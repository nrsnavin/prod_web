import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, FileJson, BadgeCheck, ClipboardPaste, XCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { TableScroll } from "@/components/ui/TableScroll";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useTrackRecent } from "@/core/ui/uiStore";
import { useInvoice, useInvoiceMutations } from "./hooks";
import { invoiceService } from "./api";
import { IrnDialog } from "./IrnDialog";
import { money, qty } from "./gst";
import { einvoiceLabel, einvoiceTone, invoiceStatusTone } from "./invoiceStatus";
import type { InvoiceParty } from "./types";

const STATE: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};
const stateName = (code: string) => (code ? `${STATE[code] ?? "State"} (${code})` : "—");

function Party({ title, p }: { title: string; p: InvoiceParty }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
      <p className="mt-1 font-semibold">{p.name || "—"}</p>
      {(p.address || p.city) && (
        <p className="text-sm text-ink-600">{[p.address, [p.city, p.pincode].filter(Boolean).join(" - ")].filter(Boolean).join(", ")}</p>
      )}
      <p className="text-sm text-ink-600">{stateName(p.stateCode)}</p>
      <p className="text-sm text-ink-600">GSTIN {p.gstin || "—"}</p>
    </div>
  );
}

const when = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${formatDate(d)} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
};

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: inv, isLoading, isError, error } = useInvoice(id);
  const { registerIrn, pasteIrn, cancel } = useInvoiceMutations();
  const [busy, setBusy] = useState<"pdf" | "json" | null>(null);
  const [irnOpen, setIrnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notReady, setNotReady] = useState<string[] | null>(null);
  useTrackRecent("Invoice", `/invoices/${id}`, inv?.invoiceNumber);

  const download = async (kind: "pdf" | "json") => {
    if (!id || !inv) return;
    setBusy(kind);
    try {
      const blob = kind === "pdf" ? await invoiceService.pdfBlob(id) : await invoiceService.einvoiceJsonBlob(id);
      const url = URL.createObjectURL(blob);
      if (kind === "pdf") {
        window.open(url, "_blank", "noopener");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${inv.invoiceNumber.replace(/\//g, "-")}-einvoice.json`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not prepare the file", "error");
    } finally {
      setBusy(null);
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
  if (isError || !inv) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Invoice not found"}
      </p>
    );
  }

  const inter = inv.supplyType === "inter";
  const issued = inv.status === "issued";
  const registered = inv.einvoice.status === "registered";
  const problems = inv.einvoiceProblems ?? [];

  const register = () =>
    registerIrn.mutate(inv._id, {
      onSuccess: (next) => toast(`IRN registered — ${next.einvoice.irn}`, "success"),
      onError: (e) => {
        if (e instanceof ApiError && e.code === "EINVOICE_NOT_CONFIGURED") {
          toast(e.message, "error");
          setIrnOpen(true);
          return;
        }
        if (e instanceof ApiError && e.code === "EINVOICE_NOT_READY") {
          const list = ((e.data?.details as { problems?: string[] } | undefined)?.problems ?? []) as string[];
          setNotReady(list.length ? list : [e.message]);
          return;
        }
        toast(e instanceof ApiError ? e.message : "Could not register the IRN", "error");
      },
    });

  return (
    <>
      <Link to="/invoices" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Link>
      <PageHeader
        title={inv.invoiceNumber}
        subtitle={`${inv.buyer.name} · ${formatDate(inv.invoiceDate)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => download("pdf")} loading={busy === "pdf"}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="secondary" onClick={() => download("json")} loading={busy === "json"}>
              <FileJson className="h-4 w-4" /> e-Invoice JSON
            </Button>
            {issued && !registered && (
              <>
                <Button onClick={register} loading={registerIrn.isPending}>
                  <BadgeCheck className="h-4 w-4" /> Register IRN
                </Button>
                <Button variant="secondary" onClick={() => setIrnOpen(true)}>
                  <ClipboardPaste className="h-4 w-4" /> Paste IRN
                </Button>
              </>
            )}
            {issued && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusChip tone={invoiceStatusTone[inv.status]}>{inv.status}</StatusChip>
        <StatusChip tone={einvoiceTone[inv.einvoice.status]}>{einvoiceLabel[inv.einvoice.status]}</StatusChip>
        <StatusChip tone="neutral">{inter ? "IGST · inter-state" : "CGST + SGST · in-state"}</StatusChip>
        {inv.status === "cancelled" && inv.cancel?.reason && (
          <span className="text-sm text-status-danger">Cancelled: {inv.cancel.reason}</span>
        )}
      </div>

      {issued && !registered && problems.length > 0 && (
        <div role="alert" className="mb-4 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4" /> Not ready for the e-invoice portal yet:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Fix it on the customer record or in Settings, then cancel this invoice and raise it again — an issued invoice is never edited.</p>
        </div>
      )}
      {notReady && (
        <div role="alert" className="mb-4 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
          <p className="font-medium">The portal would refuse this invoice:</p>
          <ul className="mt-1 list-disc pl-5">
            {notReady.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {registered && (
        <Card className="mb-4 p-5" aria-label="e-Invoice">
          <h3 className="font-semibold">e-Invoice</h3>
          <DescriptionList
            columns={3}
            items={[
              { label: "IRN", value: <span className="break-all font-mono text-xs">{inv.einvoice.irn}</span> },
              { label: "Ack no.", value: inv.einvoice.ackNo || undefined },
              { label: "Ack date", value: when(inv.einvoice.ackDate) },
              { label: "Registered through", value: inv.einvoice.provider === "manual" ? "Pasted from the portal" : inv.einvoice.provider },
              { label: "Signed QR", value: inv.einvoice.signedQr ? "On the printed invoice" : "Not supplied" },
            ]}
          />
        </Card>
      )}

      <Card className="p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Party title="Seller" p={inv.seller} />
          <Party title="Billed to" p={inv.buyer} />
        </div>
        <div className="mt-6">
          <DescriptionList
            columns={3}
            items={[
              { label: "Invoice date", value: formatDate(inv.invoiceDate) },
              {
                label: "Against order",
                value: inv.orderNo != null ? <Link className="text-brand-600 hover:underline" to={`/orders/${inv.order}`}>#{inv.orderNo}</Link> : undefined,
              },
              { label: "Buyer's order no.", value: inv.customerPo || undefined },
              { label: "Place of supply", value: stateName(inv.placeOfSupply) },
              { label: "Ship to", value: inv.shipTo || undefined },
              { label: "Total boxes", value: inv.totalBoxes ? String(inv.totalBoxes) : undefined },
              {
                label: "Delivery challans",
                value: inv.dcs.length
                  ? inv.dcs.map((d, i) => (
                      <span key={d.dc}>
                        {i > 0 && ", "}
                        <Link className="text-brand-600 hover:underline" to={`/delivery-challans/${d.dc}`}>{d.dcNumber}</Link>
                      </span>
                    ))
                  : undefined,
              },
              { label: "Note", value: inv.notes || undefined },
            ]}
          />
        </div>

        <TableScroll>
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 text-left font-medium">#</th>
                <th className="py-2 text-left font-medium">Description</th>
                <th className="py-2 text-left font-medium">HSN</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Rate</th>
                <th className="py-2 text-right font-medium">Taxable</th>
                <th className="py-2 text-right font-medium">GST</th>
                {inter ? (
                  <th className="py-2 text-right font-medium">IGST</th>
                ) : (
                  <>
                    <th className="py-2 text-right font-medium">CGST</th>
                    <th className="py-2 text-right font-medium">SGST</th>
                  </>
                )}
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {inv.lines.map((l, i) => (
                <tr key={`${l.elastic ?? l.name}-${i}`}>
                  <td className="py-2 tabular-nums text-ink-400">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{l.name}</p>
                    {l.dcNumbers?.length ? <p className="text-xs text-ink-400">{l.dcNumbers.join(", ")}</p> : null}
                  </td>
                  <td className="py-2">{l.hsn || "—"}</td>
                  <td className="py-2 text-right tabular-nums">
                    {qty(l.quantity)} {l.unit}
                    {l.boxes ? <span className="block text-xs text-ink-400">{l.boxes} box{l.boxes === 1 ? "" : "es"}</span> : null}
                  </td>
                  <td className="py-2 text-right tabular-nums">{money(l.rate)}</td>
                  <td className="py-2 text-right tabular-nums">{money(l.taxable)}</td>
                  <td className="py-2 text-right tabular-nums">{l.gstPercent}%</td>
                  {inter ? (
                    <td className="py-2 text-right tabular-nums">{money(l.igst)}</td>
                  ) : (
                    <>
                      <td className="py-2 text-right tabular-nums">{money(l.cgst)}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.sgst)}</td>
                    </>
                  )}
                  <td className="py-2 text-right tabular-nums font-semibold">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-ink-600 sm:max-w-md">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Amount in words</span>
            <br />
            {inv.amountInWords}
          </p>
          <dl className="w-full text-sm sm:w-64" aria-label="Totals">
            <div className="flex justify-between"><dt className="text-ink-500">Taxable value</dt><dd className="tabular-nums">{money(inv.totals.taxable)}</dd></div>
            {inter ? (
              <div className="flex justify-between"><dt className="text-ink-500">IGST</dt><dd className="tabular-nums">{money(inv.totals.igst)}</dd></div>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-ink-500">CGST</dt><dd className="tabular-nums">{money(inv.totals.cgst)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">SGST</dt><dd className="tabular-nums">{money(inv.totals.sgst)}</dd></div>
              </>
            )}
            <div className="flex justify-between"><dt className="text-ink-500">Round off</dt><dd className="tabular-nums">{money(inv.totals.roundOff)}</dd></div>
            <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">₹{money(inv.totals.grand)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {(inv.fingerprints?.length ?? 0) > 0 && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">History</h3>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {inv.fingerprints!.map((f, i) => (
              <li key={`${f.code}-${i}`} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{f.label}</span>
                  {f.actor?.name ? <span className="text-ink-400"> · {f.actor.name}</span> : null}
                  {typeof f.meta?.reason === "string" ? <span className="text-ink-400"> · {f.meta.reason}</span> : null}
                </span>
                <span className="text-ink-400">{when(f.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {irnOpen && (
        <IrnDialog
          invoiceNumber={inv.invoiceNumber}
          loading={pasteIrn.isPending}
          onClose={() => setIrnOpen(false)}
          onConfirm={(body) =>
            pasteIrn.mutate(
              { id: inv._id, body },
              {
                onSuccess: () => {
                  setIrnOpen(false);
                  toast("IRN saved — the invoice now prints with its QR", "success");
                },
                onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save the IRN", "error"),
              }
            )
          }
        />
      )}

      <ReasonDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${inv.invoiceNumber}?`}
        description={
          registered
            ? "The IRN is cancelled with it. The challans on it can go on a new invoice. This cannot be undone."
            : "The challans on it can go on a new invoice. This cannot be undone."
        }
        confirmLabel="Cancel invoice"
        minLength={8}
        loading={cancel.isPending}
        onConfirm={(reason) =>
          cancel.mutate(
            { id: inv._id, reason },
            {
              onSuccess: ({ portalNote }) => {
                setCancelOpen(false);
                toast(portalNote ? `Invoice cancelled. ${portalNote}` : "Invoice cancelled", portalNote ? "info" : "success");
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Could not cancel", "error"),
            }
          )
        }
      />
    </>
  );
}
