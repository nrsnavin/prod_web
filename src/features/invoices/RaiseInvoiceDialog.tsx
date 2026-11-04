import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { CreditBand, useCreditHold } from "@/features/customers/credit";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useInvoiceMutations, useInvoiceOrderInfo } from "./hooks";
import { draftLines, money, priceLines, qty } from "./gst";
import type { ExportKind, InvoiceLineOverride, SupplyType } from "./types";

/**
 * Raise a tax invoice for an order.
 *
 * The challans that have left and are not yet invoiced come ticked;
 * one already on an invoice says which and cannot be ticked. The lines
 * are the ticked challans' items merged per product, priced from the
 * order, with the HSN and GST % from Settings (or the elastic's own)
 * — each can be typed over before raising. The totals and the tax
 * split (CGST + SGST in-state, IGST outside) are shown as the server
 * will compute them.
 */
export function RaiseInvoiceDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: info, isLoading, isError, error } = useInvoiceOrderInfo(orderId);
  const { create } = useInvoiceMutations();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, InvoiceLineOverride>>({});
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [shipTo, setShipTo] = useState("");
  // Export / SEZ: the kind, and what the portal and customs want with it.
  const [exportKind, setExportKind] = useState<ExportKind | "">("");
  const [currency, setCurrency] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number | "">("");
  const [countryCode, setCountryCode] = useState("");
  const [portCode, setPortCode] = useState("");
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!info || seeded) return;
    setSelected(new Set(info.dcs.filter((d) => d.eligible).map((d) => d._id)));
    setShipTo(info.shipTo ?? "");
    setExportKind(info.export?.suggested ?? "");
    setCurrency(info.export?.currency || "");
    setSeeded(true);
  }, [info, seeded]);
  const kindInfo = info?.export?.kinds.find((k) => k.kind === exportKind);
  const abroad = exportKind === "EXPWP" || exportKind === "EXPWOP";
  const lutOk = !kindInfo?.needsLut || !!info?.export?.lut.number;

  const lines = useMemo(
    () => (info ? draftLines(info.dcs, selected, info.lines, overrides, info.defaults) : []),
    [info, selected, overrides]
  );
  const supplyType: SupplyType = abroad ? "export" : exportKind === "SEZWP" || exportKind === "SEZWOP" ? "sez" : (info?.supplyType ?? "intra");
  const priced = useMemo(() => priceLines(lines, supplyType, !!kindInfo?.zeroRated), [lines, supplyType, kindInfo?.zeroRated]);
  const inter = supplyType !== "intra";
  const unpriced = priced.lines.filter((l) => !(l.rate > 0));
  const exportReady = !exportKind || (lutOk && (!abroad || (countryCode.trim().length === 2 && (!currency || currency === "INR" || Number(exchangeRate) > 0))));
  const canRaise = !!info && selected.size > 0 && lines.length > 0 && unpriced.length === 0 && exportReady && !create.isPending;

  const setOverride = (elastic: string, patch: Partial<InvoiceLineOverride>) =>
    setOverrides((o) => ({ ...o, [elastic]: { ...(o[elastic] ?? { elastic }), ...patch } }));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hold = useCreditHold("this invoice");
  const raise = () => hold.run((creditOverride) =>
    create.mutate(
      {
        creditOverride,
        orderId,
        dcIds: [...selected],
        invoiceDate,
        notes: notes.trim() || undefined,
        shipTo: shipTo.trim() || undefined,
        lines: Object.values(overrides).filter((o) => selected.size && lines.some((l) => l.elastic === o.elastic)),
        export: exportKind ? { kind: exportKind, currency: abroad ? (currency.trim().toUpperCase() || "INR") : undefined, exchangeRate: abroad && currency && currency.toUpperCase() !== "INR" ? Number(exchangeRate) : undefined, countryCode: abroad ? countryCode.trim().toUpperCase() : undefined, portCode: abroad ? portCode.trim().toUpperCase() || undefined : undefined } : undefined,
      },
      {
        onSuccess: (inv) => {
          toast(`Invoice ${inv.invoiceNumber} raised`, "success");
          onClose();
          navigate(`/invoices/${inv._id}`);
        },
        onError: (e) => { if (!hold.onError(e)) toast(e instanceof ApiError ? e.message : "Could not raise the invoice", "error"); },
      }
    ));

  return (
    <Modal open onClose={onClose} title="Raise invoice" width="max-w-4xl">
      {isLoading && <Skeleton className="h-64 w-full" />}
      {isError && <ErrorBanner message={(error as Error).message} />}
      {hold.dialog}
      {info && (
        <div className="space-y-5">
          <CreditBand customerId={info.order.customer} />
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <p>
              <span className="font-semibold">Order #{info.order.orderNo}</span>
              {info.order.po ? <span className="text-ink-400"> · PO {info.order.po}</span> : null}
              <span className="text-ink-400"> · {info.buyer.name}</span>
            </p>
            <StatusChip tone={inter ? "info" : "neutral"}>
              {kindInfo?.zeroRated ? "Zero-rated under LUT — no IGST" : abroad ? "IGST — export (with payment)" : supplyType === "sez" ? "IGST — SEZ unit (with payment)" : inter ? `IGST — inter-state (${info.placeOfSupply})` : "CGST + SGST — in-state"}
            </StatusChip>
          </div>

          {info.export && (info.export.suggested || exportKind || info.export.kinds.length > 0) && (
            <div className="rounded-lg border border-ink-200 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Export / SEZ" value={exportKind} onChange={(e) => setExportKind(e.target.value as ExportKind | "")}
                  options={[{ value: "", label: "Domestic sale" }, ...info.export.kinds.map((k) => ({ value: k.kind, label: k.label }))]} />
                {kindInfo?.needsLut && (
                  <p className={`self-end text-sm ${lutOk ? "text-ink-500" : "text-status-danger"}`}>{lutOk ? `Under LUT ${info.export.lut.number}` : "No LUT on file — enter it in Accounts → Settings, or raise with IGST."}</p>
                )}
                {abroad && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Country code *" value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} placeholder="DE, US, AE" />
                      <Input label="Port code" value={portCode} onChange={(e) => setPortCode(e.target.value.toUpperCase())} placeholder="INMAA1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="INR" />
                      {currency && currency.toUpperCase() !== "INR" && <Input label={`₹ per ${currency.toUpperCase()} *`} type="number" min={0} step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value === "" ? "" : Number(e.target.value))} />}
                    </div>
                  </>
                )}
              </div>
              {exportKind && <p className="mt-2 text-xs text-ink-400">{abroad ? "The buyer goes on the e-invoice as unregistered abroad (place of supply 96); the shipping bill is added once customs issue it." : exportKind === "DEXP" ? "Taxed like a domestic sale, reported apart in GSTR-1 (DE)." : "The SEZ unit's GSTIN goes on the e-invoice; GSTR-1 marks it SEWP / SEWOP."}</p>}
            </div>
          )}

          {info.problems.length > 0 && (
            <div role="alert" className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4" /> The invoice can be raised, but the e-invoice portal will refuse it until this is fixed:
              </p>
              <ul className="mt-1 list-disc pl-5">
                {info.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Challans ─────────────────────────────────────── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Delivery challans</p>
            {info.dcs.length === 0 ? (
              <p className="text-sm text-ink-400">No challans have been raised against this order.</p>
            ) : (
              <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                {info.dcs.map((dc) => (
                  <li key={dc._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`Include ${dc.dcNumber}`}
                      checked={selected.has(dc._id)}
                      disabled={!dc.eligible}
                      onChange={() => toggle(dc._id)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{dc.dcNumber}</span>
                    <span className="text-ink-400">{formatDate(dc.dispatchDate)}</span>
                    <span className="ml-auto tabular-nums">{qty(dc.totalQuantity)} m</span>
                    {dc.invoicedOn ? (
                      <StatusChip tone="neutral">on {dc.invoicedOn}</StatusChip>
                    ) : !dc.eligible ? (
                      <StatusChip tone="warning">{dc.status}</StatusChip>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Lines ────────────────────────────────────────── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Lines</p>
            {lines.length === 0 ? (
              <p className="text-sm text-ink-400">Tick a challan to see its lines.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
                      <th className="py-2 text-left font-medium">Product</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Boxes</th>
                      <th className="py-2 text-right font-medium">Rate</th>
                      <th className="py-2 text-left font-medium">HSN</th>
                      <th className="py-2 text-right font-medium">GST %</th>
                      <th className="py-2 text-right font-medium">Taxable</th>
                      <th className="py-2 text-right font-medium">Tax</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {priced.lines.map((l) => (
                      <tr key={l.elastic}>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{l.name}</p>
                          <p className="text-xs text-ink-400">{l.dcNumbers.join(", ")}</p>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {qty(l.quantity)} {l.unit}
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            aria-label={`Boxes for ${l.name}`}
                            type="number"
                            step="1"
                            min={0}
                            className="w-16 text-right"
                            value={overrides[l.elastic]?.boxes ?? l.boxes ?? ""}
                            onChange={(e) => setOverride(l.elastic, { boxes: e.target.value === "" ? "" : Math.max(0, Math.floor(Number(e.target.value))) })}
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            aria-label={`Rate for ${l.name}`}
                            type="number"
                            step="0.01"
                            min={0}
                            className="w-24 text-right"
                            value={overrides[l.elastic]?.rate ?? l.rate}
                            onChange={(e) => setOverride(l.elastic, { rate: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                          {l.rateSource === "none" && <p className="text-xs text-status-danger">no rate on the order</p>}
                          {l.rateSource === "order" && <p className="text-xs text-ink-400">from the order</p>}
                        </td>
                        <td className="py-2">
                          <Input
                            aria-label={`HSN for ${l.name}`}
                            className="w-24"
                            value={overrides[l.elastic]?.hsn ?? l.hsn}
                            onChange={(e) => setOverride(l.elastic, { hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            aria-label={`GST % for ${l.name}`}
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            className="w-20 text-right"
                            value={overrides[l.elastic]?.gstPercent ?? l.gstPercent}
                            onChange={(e) => setOverride(l.elastic, { gstPercent: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                        </td>
                        <td className="py-2 text-right tabular-nums">{money(l.taxable)}</td>
                        <td className="py-2 text-right tabular-nums">{money(l.cgst + l.sgst + l.igst)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">{money(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Totals and the rest ──────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Input label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Input label="Ship to" placeholder="Where the goods went" value={shipTo} onChange={(e) => setShipTo(e.target.value)} />
              <Input label="Note on the invoice" placeholder="e.g. Thank you for your recent purchase." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <dl className="rounded-lg bg-ink-50 p-3 text-sm" aria-label="Invoice totals">
              <div className="flex justify-between"><dt className="text-ink-500">Taxable value</dt><dd className="tabular-nums">{money(priced.totals.taxable)}</dd></div>
              {kindInfo?.zeroRated ? (
                <div className="flex justify-between"><dt className="text-ink-500">IGST (zero-rated)</dt><dd className="tabular-nums">0.00</dd></div>
              ) : inter ? (
                <div className="flex justify-between"><dt className="text-ink-500">IGST</dt><dd className="tabular-nums">{money(priced.totals.igst)}</dd></div>
              ) : (
                <>
                  <div className="flex justify-between"><dt className="text-ink-500">CGST</dt><dd className="tabular-nums">{money(priced.totals.cgst)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-500">SGST</dt><dd className="tabular-nums">{money(priced.totals.sgst)}</dd></div>
                </>
              )}
              <div className="flex justify-between"><dt className="text-ink-500">Round off</dt><dd className="tabular-nums">{money(priced.totals.roundOff)}</dd></div>
              <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">₹{money(priced.totals.grand)}</dd>
              </div>
            </dl>
          </div>

          {unpriced.length > 0 && (
            <p className="text-sm text-status-danger">
              No rate for {unpriced.map((l) => l.name).join(", ")} — enter one above, or price the order line.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={raise} disabled={!canRaise} loading={create.isPending}>
              Raise invoice
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
