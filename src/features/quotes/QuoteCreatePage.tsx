import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useQuoteMutations } from "./hooks";
import {
  MaterialRow,
  newKey,
  num,
  priceOneMetre,
  rupees,
  startingRows,
} from "./costing";

const addDays = (from: Date, days: number) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function QuoteCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { create } = useQuoteMutations();

  const [rows, setRows] = useState<MaterialRow[]>(startingRows);
  const [conversionCost, setConversionCost] = useState("1.25");
  const [marginPercent, setMarginPercent] = useState("20");
  const [gstPercent, setGstPercent] = useState("5");
  const [quantityMetres, setQuantityMetres] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [productName, setProductName] = useState("");
  const [productSpec, setProductSpec] = useState("");
  const [date, setDate] = useState(iso(new Date()));
  const [validTill, setValidTill] = useState(iso(addDays(new Date(), 30)));
  const [remarks, setRemarks] = useState("");

  // Priced on every keystroke. The server prices it again on save and
  // that figure is the one stored — this is here so the sheet answers
  // while you are still deciding.
  const costing = useMemo(
    () => priceOneMetre({ materials: rows, conversionCost, marginPercent, gstPercent, quantityMetres }),
    [rows, conversionCost, marginPercent, gstPercent, quantityMetres]
  );

  const setRow = (key: string, patch: Partial<MaterialRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { key: newKey(), label: "", weightGrams: "", ratePerKg: "" }]);
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const resetRows = () => setRows(startingRows());

  const priced = rows.filter((r) => num(r.weightGrams) > 0 || num(r.ratePerKg) > 0);

  const save = () => {
    if (!customerName.trim()) { toast("Who is this quote for?", "error"); return; }
    if (!productName.trim()) { toast("Name the product being quoted", "error"); return; }
    if (priced.length === 0) {
      toast("Fill in at least one material — a weight and a rate", "error");
      return;
    }
    const unnamed = priced.find((r) => !r.label.trim());
    if (unnamed) {
      toast("Every filled-in line needs a material name", "error");
      return;
    }

    create.mutate(
      {
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerGstin: customerGstin.trim(),
        customerRef: customerRef.trim(),
        productName: productName.trim(),
        productSpec: productSpec.trim(),
        date,
        validTill,
        remarks: remarks.trim(),
        // Weights and rates only. The totals on screen are the browser's
        // working; the server does its own and that is what is stored.
        materials: priced.map((r) => ({
          label: r.label.trim(),
          weightGrams: num(r.weightGrams),
          ratePerKg: num(r.ratePerKg),
        })),
        conversionCost: num(conversionCost),
        marginPercent: num(marginPercent),
        gstPercent: num(gstPercent),
        quantityMetres: num(quantityMetres),
      },
      {
        onSuccess: (q) => {
          toast(`Quotation ${q.quoteNo} raised`, "success");
          navigate(`/quotes/${q._id}`);
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Could not raise the quotation", "error"),
      }
    );
  };

  return (
    <>
      <Link to="/quotes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Quotations
      </Link>
      <PageHeader
        title="New quotation"
        subtitle="Cost one metre, then price it"
        actions={
          <Button loading={create.isPending} onClick={save}>
            Raise quotation
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── The costing sheet ─────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <h3 className="font-semibold">Materials in one metre</h3>
                <p className="text-sm text-ink-400">
                  Weight in grams, rate in rupees per kilogram.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={resetRows}>
                <RotateCcw className="h-4 w-4" /> Reset rows
              </Button>
            </div>

            <div className="hidden grid-cols-[1fr_110px_120px_120px_32px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
              <span>Material</span>
              <span className="text-right">Weight (g)</span>
              <span className="text-right">Rate (₹/kg)</span>
              <span className="text-right">Cost / metre</span>
              <span />
            </div>

            <div className="space-y-2">
              {rows.map((r) => {
                const cost = costing.rows.find((c) => c.key === r.key)?.cost ?? 0;
                return (
                  <div key={r.key} className="grid grid-cols-[1fr_110px_120px_120px_32px] items-start gap-2">
                    <Input
                      aria-label={r.fixed ? `${r.label} name` : "Material name"}
                      placeholder="Material"
                      value={r.label}
                      // The four named rows keep their names; anything
                      // added is the user's to call what they like.
                      readOnly={r.fixed}
                      onChange={(e) => setRow(r.key, { label: e.target.value })}
                      className={r.fixed ? "bg-ink-50" : undefined}
                    />
                    <Input
                      type="number" step="0.001" min="0"
                      aria-label={`Weight in grams for ${r.label || "material"}`}
                      placeholder="0"
                      value={r.weightGrams}
                      onChange={(e) => setRow(r.key, { weightGrams: e.target.value })}
                    />
                    <Input
                      type="number" step="0.01" min="0"
                      aria-label={`Rate per kilogram for ${r.label || "material"}`}
                      placeholder="0"
                      value={r.ratePerKg}
                      onChange={(e) => setRow(r.key, { ratePerKg: e.target.value })}
                    />
                    <div className="flex h-10 items-center justify-end text-sm tabular-nums text-ink-900">
                      ₹{rupees(cost, 4)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      aria-label={`Remove ${r.label || "row"}`}
                      className="grid h-10 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add material
              </Button>
              <p className="text-sm text-ink-600">
                {costing.totalWeightGrams > 0 && (
                  <span className="mr-4 text-ink-400">
                    {rupees(costing.totalWeightGrams, 2)} g / metre
                  </span>
                )}
                Materials{" "}
                <span className="font-semibold tabular-nums text-ink-900">
                  ₹{rupees(costing.materialCost, 4)}
                </span>
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 font-semibold">Conversion, margin and tax</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <Input
                label="Conversion (₹/m)" type="number" step="0.01" min="0"
                value={conversionCost} onChange={(e) => setConversionCost(e.target.value)}
              />
              <Input
                label="Margin %" type="number" step="0.01" min="0"
                value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)}
              />
              <Input
                label="GST %" type="number" step="0.01" min="0"
                value={gstPercent} onChange={(e) => setGstPercent(e.target.value)}
              />
              <Input
                label="Quantity (m)" type="number" step="1" min="0"
                placeholder="optional"
                value={quantityMetres} onChange={(e) => setQuantityMetres(e.target.value)}
              />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Margin is a markup on cost — 20% on ₹100 of cost gives ₹120.
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="mb-4 font-semibold">Customer and product</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Customer *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <Input label="Their reference / enquiry no" value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="Customer address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              <Input label="Customer GSTIN" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="Product *" placeholder="e.g. 20mm Woven Elastic" value={productName} onChange={(e) => setProductName(e.target.value)} />
              <Input label="Specification" placeholder="Width, elongation, recovery…" value={productSpec} onChange={(e) => setProductSpec(e.target.value)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="Quote date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Valid until" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-ink-600">Remarks</label>
              <textarea
                rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="Shown on the quotation"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </Card>
        </div>

        {/* ── The running price ─────────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-4 font-semibold">Price per metre</h3>
            <dl className="space-y-2 text-sm">
              <Line label="Materials" value={costing.materialCost} />
              <Line label="Conversion" value={costing.conversionCost} />
              <div className="border-t border-ink-100 pt-2">
                <Line label="Cost per metre" value={costing.totalCost} bold />
              </div>
              <Line label={`Margin @ ${rupees(costing.marginPercent, 2)}%`} value={costing.marginAmount} />
              <div className="border-t border-ink-100 pt-2">
                <Line label="Rate (ex-GST)" value={costing.rateBeforeTax} bold />
              </div>
              <Line label={`GST @ ${rupees(costing.gstPercent, 2)}%`} value={costing.gstAmount} />
              <div className="border-t-2 border-ink-900 pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">Rate inc. GST</dt>
                  <dd className="text-xl font-bold tabular-nums">₹{rupees(costing.rateInclTax, 4)}</dd>
                </div>
              </div>
            </dl>

            {costing.quantityMetres > 0 && (
              <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  For {costing.quantityMetres.toLocaleString("en-IN")} m
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-ink-600">Value (ex-GST)</span>
                  <span className="tabular-nums">₹{rupees(costing.valueBeforeTax)}</span>
                </div>
                <div className="flex items-baseline justify-between font-semibold">
                  <span>Value inc. GST</span>
                  <span className="tabular-nums">₹{rupees(costing.valueInclTax)}</span>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-ink-400">
              Shown to four decimal places while you work. The quotation prints
              to two, and the server prices it again when you save.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={bold ? "font-semibold" : "text-ink-600"}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold" : ""}`}>₹{rupees(value, 4)}</dd>
    </div>
  );
}

export default QuoteCreatePage;
