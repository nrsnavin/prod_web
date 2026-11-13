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

/** "1 box", "20 boxes"; "no boxes" when the challans carry none. */
export const boxesText = (n: number | undefined) => {
  const v = Number(n) || 0;
  return v === 0 ? "no boxes" : `${v.toLocaleString("en-IN")} ${v === 1 ? "box" : "boxes"}`;
};

/** A percentage without trailing zeros: 5, 2.5, 12. */
const pct = (n: number) => `${Number((Number(n) || 0).toFixed(2))}%`;

/**
 * What the e-invoice portal would refuse, grouped by where each is put
 * right: the company's settings, the customer's record, the lines. The
 * server's own words, unchanged; only sorted.
 */
export function groupProblems(problems: string[], buyerName: string): Array<{ title: string; items: string[] }> {
  const settings: string[] = [];
  const customer: string[] = [];
  const lines: string[] = [];
  const other: string[] = [];
  for (const p of problems) {
    if (/\(Settings\b/i.test(p)) settings.push(p);
    else if (/customer record/i.test(p)) customer.push(p);
    else if (/^Line \d+/i.test(p)) lines.push(p);
    else other.push(p);
  }
  return [
    { title: "Your company settings", items: settings },
    { title: `The customer, ${buyerName}`, items: customer },
    { title: "The lines", items: lines },
    { title: "Also", items: other },
  ].filter((g) => g.items.length > 0);
}

/**
 * Raise a tax invoice for an order.
 *
 * The challans that have left and are not yet invoiced come ticked;
 * one already on an invoice says which and cannot be ticked. The lines
 * are the ticked challans' items merged per product, priced from the
 * order, with the HSN and GST % from Settings (or the elastic's own)
 * — each can be typed over before raising. The boxes are the challans'
 * own, added up: they are counted when the goods go out and are not
 * typed again here. The totals and the tax split (CGST + SGST in-state,
 * IGST outside) are shown as the server will compute them.
 *
 * Laid out a line to a block, its figures labelled, rather than as a
 * nine-column table of inputs: in a dialog that table squeezed the
 * product name onto two lines and ran the taxable, tax and amount
 * figures into one another.
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
  // A long list of what the portal would refuse starts folded: it is
  // worth fixing, but it does not stop the invoice.
  const [problemsOpen, setProblemsOpen] = useState<boolean | null>(null);

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
  // Every box on the ticked challans: what the invoice will carry.
  const totalBoxes = priced.lines.reduce((a, l) => a + (Number(l.boxes) || 0), 0);
  const problemGroups = info ? groupProblems(info.problems, info.buyer.name) : [];
  const showProblems = problemsOpen ?? (info ? info.problems.length <= 3 : false);
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
            <div role="alert" className="rounded-lg border border-status-warning/30 bg-status-warningBg px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="flex items-center gap-2 font-medium text-status-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {info.problems.length === 1
                    ? "One detail is missing for the e-invoice portal."
                    : `${info.problems.length} details are missing for the e-invoice portal.`}
                  <span className="font-normal text-ink-600">The invoice can still be raised.</span>
                </p>
                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 hover:underline"
                  aria-expanded={showProblems}
                  onClick={() => setProblemsOpen(!showProblems)}
                >
                  {showProblems ? "Hide" : "Show what's missing"}
                </button>
              </div>
              {/* Not rendered while folded: a `hidden` attribute loses to the
                  grid class's display, and the list showed anyway. */}
              {showProblems && (
              <div className="mt-2 grid gap-3 border-t border-status-warning/20 pt-2 sm:grid-cols-2">
                {problemGroups.map((g) => (
                  <div key={g.title}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{g.title}</p>
                    <ul className="mt-1 space-y-1 text-ink-700">
                      {g.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-status-warning" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {/* ── Challans ─────────────────────────────────────── */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Delivery challans</p>
              <p className="text-xs text-ink-400">Boxes are counted on the challan. Edit the challan to change them.</p>
            </div>
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
                    {(() => {
                      const boxes = dc.totalBoxes ?? dc.items.reduce((a, i) => a + (Number(i.boxes) || 0), 0);
                      return (
                        <span className={`ml-auto tabular-nums ${boxes === 0 && dc.eligible ? "text-status-warning" : "text-ink-500"}`}>
                          {boxesText(boxes)}
                        </span>
                      );
                    })()}
                    <span className="w-24 text-right tabular-nums font-medium">{qty(dc.totalQuantity)} m</span>
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
              <ul className="space-y-3">
                {priced.lines.map((l) => {
                  const tax = l.cgst + l.sgst + l.igst;
                  return (
                    <li key={l.elastic} className="rounded-lg border border-ink-200 p-3 sm:p-4">
                      {/* What it is, how much went, and what it comes to. */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-ink-900">{l.name}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                            <span className="tabular-nums text-ink-700">{qty(l.quantity)} {l.unit}</span>
                            <span aria-hidden className="text-ink-300">·</span>
                            <span className={`tabular-nums ${(Number(l.boxes) || 0) === 0 ? "text-status-warning" : "text-ink-700"}`}>{boxesText(l.boxes)}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-ink-400">{l.dcNumbers.join(", ")}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-semibold tabular-nums text-ink-900">₹{money(l.amount)}</p>
                          <p className="text-xs text-ink-400">with tax</p>
                        </div>
                      </div>

                      {/* What can be typed over, each field named; the sums beside them. */}
                      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-ink-100 pt-3">
                        <div className="grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] gap-2 sm:w-auto sm:grid-cols-[8.5rem_7.5rem_5.5rem]">
                          <Input
                            label={`Rate (₹ / ${l.unit})`}
                            aria-label={`Rate for ${l.name}`}
                            type="number"
                            step="0.01"
                            min={0}
                            className="text-right tabular-nums"
                            value={overrides[l.elastic]?.rate ?? l.rate}
                            onChange={(e) => setOverride(l.elastic, { rate: e.target.value === "" ? "" : Number(e.target.value) })}
                            error={l.rateSource === "none" && !(l.rate > 0) ? "No rate on the order" : undefined}
                            hint={l.rateSource === "order" ? "From the order" : l.rateSource === "challan" ? "From the challan" : undefined}
                          />
                          <Input
                            label="HSN"
                            aria-label={`HSN for ${l.name}`}
                            inputMode="numeric"
                            className="tabular-nums"
                            value={overrides[l.elastic]?.hsn ?? l.hsn}
                            onChange={(e) => setOverride(l.elastic, { hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                          />
                          <Input
                            label="GST %"
                            aria-label={`GST % for ${l.name}`}
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            className="text-right tabular-nums"
                            value={overrides[l.elastic]?.gstPercent ?? l.gstPercent}
                            onChange={(e) => setOverride(l.elastic, { gstPercent: e.target.value === "" ? "" : Number(e.target.value) })}
                          />
                        </div>
                        <dl className="grid w-full grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm sm:mt-6 sm:w-auto sm:min-w-[13rem]" aria-label={`Sums for ${l.name}`}>
                          <dt className="text-ink-500">Taxable</dt>
                          <dd className="text-right tabular-nums">{money(l.taxable)}</dd>
                          <dt className="text-ink-500">{kindInfo?.zeroRated ? "IGST (zero-rated)" : inter ? `IGST ${pct(l.gstPercent)}` : `CGST + SGST ${pct(l.gstPercent)}`}</dt>
                          <dd className="text-right tabular-nums">{money(tax)}</dd>
                        </dl>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Totals and the rest ──────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <Input label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              <Input label="Ship to" placeholder="Where the goods went" value={shipTo} onChange={(e) => setShipTo(e.target.value)} />
              <Input label="Note on the invoice" placeholder="e.g. Thank you for your recent purchase." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <dl className="space-y-1.5 self-start rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm" aria-label="Invoice totals">
              <div className="flex justify-between border-b border-ink-200 pb-2">
                <dt className="text-ink-500">Total boxes <span className="text-xs text-ink-400">(from the challans)</span></dt>
                <dd className="font-medium tabular-nums" data-testid="invoice-total-boxes">{totalBoxes.toLocaleString("en-IN")}</dd>
              </div>
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
              <div className="mt-1 flex items-baseline justify-between border-t border-ink-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums text-ink-900">₹{money(priced.totals.grand)}</dd>
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
