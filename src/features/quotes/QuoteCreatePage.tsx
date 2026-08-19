import { useCallback, useMemo, useState } from "react";
import { UnsavedChangesGuard } from "@/components/ui/UnsavedChangesGuard";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, RotateCcw, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AsyncCombobox } from "@/components/ui/AsyncCombobox";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { customerService } from "@/features/customers/api";
import { useQuoteMutations } from "./hooks";
import {
  MaterialRow,
  ProductLine,
  newKey,
  newProduct,
  num,
  priceQuote,
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

  const [products, setProducts] = useState<ProductLine[]>(() => [newProduct()]);
  const [gstPercent, setGstPercent] = useState("5");
  const [saved, setSaved] = useState(false);

  // Two ways to name a customer, because a quotation is usually the
  // FIRST thing sent to somebody who is not on the books yet.
  const [fromMaster, setFromMaster] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerRef, setCustomerRef] = useState("");

  const [date, setDate] = useState(iso(new Date()));
  const [validTill, setValidTill] = useState(iso(addDays(new Date(), 30)));
  const [remarks, setRemarks] = useState("");

  const loadCustomers = useCallback(
    (q: string) =>
      customerService
        .list({ page: 1, limit: 50, search: q })
        .then((r) => r.customers.map((c) => ({ value: c._id, label: c.name }))),
    []
  );

  // Priced on every keystroke. The server prices it again on save and
  // that figure is the one stored — this answers while you decide.
  const costing = useMemo(
    () => priceQuote(products, gstPercent),
    [products, gstPercent]
  );

  const setProduct = (key: string, patch: Partial<ProductLine>) =>
    setProducts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const addProduct = () => setProducts((ps) => [...ps, newProduct()]);
  const removeProduct = (key: string) =>
    setProducts((ps) => (ps.length > 1 ? ps.filter((p) => p.key !== key) : ps));

  const setRow = (pKey: string, rKey: string, patch: Partial<MaterialRow>) =>
    setProducts((ps) =>
      ps.map((p) =>
        p.key === pKey
          ? { ...p, materials: p.materials.map((m) => (m.key === rKey ? { ...m, ...patch } : m)) }
          : p
      )
    );
  const addRow = (pKey: string) =>
    setProducts((ps) =>
      ps.map((p) =>
        p.key === pKey
          ? { ...p, materials: [...p.materials, { key: newKey(), label: "", weightGrams: "", ratePerKg: "" }] }
          : p
      )
    );
  const removeRow = (pKey: string, rKey: string) =>
    setProducts((ps) =>
      ps.map((p) =>
        p.key === pKey ? { ...p, materials: p.materials.filter((m) => m.key !== rKey) } : p
      )
    );
  const resetRows = (pKey: string) =>
    setProducts((ps) => ps.map((p) => (p.key === pKey ? { ...p, materials: startingRows() } : p)));

  const filled = (p: ProductLine) =>
    p.materials.filter((m) => num(m.weightGrams) > 0 || num(m.ratePerKg) > 0);

  // ── Is there work here worth protecting? ────────────────────────
  //  Compared against the empty form rather than tracked with a flag,
  //  so typing a character and deleting it correctly counts as nothing.
  //  `saved` turns the guard off for the navigation the save itself
  //  performs — otherwise finishing a quote asks whether you meant to
  //  leave the page you just successfully submitted.
  const started =
    customerId !== "" ||
    customerName.trim() !== "" ||
    customerRef.trim() !== "" ||
    remarks.trim() !== "" ||
    products.some((p) => p.materials.some((m) => num(m.weightGrams) > 0 || num(m.ratePerKg) > 0));

  const save = () => {
    if (fromMaster && !customerId) {
      toast("Pick a customer, or switch to entering a new one", "error");
      return;
    }
    if (!fromMaster && !customerName.trim()) {
      toast("Who is this quote for?", "error");
      return;
    }

    for (const [i, p] of products.entries()) {
      const where = `Product ${i + 1}`;
      if (!p.productName.trim()) { toast(`${where} needs a name`, "error"); return; }
      const rows = filled(p);
      if (rows.length === 0) {
        toast(`${where}: fill in at least one material — a weight and a rate`, "error");
        return;
      }
      if (rows.some((m) => !m.label.trim())) {
        toast(`${where}: every filled-in line needs a material name`, "error");
        return;
      }
    }

    create.mutate(
      {
        ...(fromMaster && customerId ? { customer: customerId } : {}),
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerGstin: customerGstin.trim(),
        customerPhone: customerPhone.trim(),
        customerRef: customerRef.trim(),
        date,
        validTill,
        remarks: remarks.trim(),
        gstPercent: num(gstPercent),
        // Weights and rates only. The totals on screen are the browser's
        // working; the server does its own and that is what is stored.
        lines: products.map((p) => ({
          productName: p.productName.trim(),
          productSpec: p.productSpec.trim(),
          conversionCost: num(p.conversionCost),
          marginPercent: num(p.marginPercent),
          quantityMetres: num(p.quantityMetres),
          materials: filled(p).map((m) => ({
            label: m.label.trim(),
            weightGrams: num(m.weightGrams),
            ratePerKg: num(m.ratePerKg),
          })),
        })),
      },
      {
        onSuccess: (q) => {
          setSaved(true);
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
      <UnsavedChangesGuard when={started && !saved} what="this quotation" />
      <Link to="/quotes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Quotations
      </Link>
      <PageHeader
        title="New quotation"
        subtitle="Cost each product a metre at a time, then price them"
        actions={
          <Button loading={create.isPending} onClick={save}>
            Raise quotation
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* ── Customer ─────────────────────────────────────── */}
          <Card className="p-5">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h3 className="font-semibold">Customer</h3>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => { setFromMaster((v) => !v); setCustomerId(""); }}
              >
                {fromMaster
                  ? <><UserPlus className="h-4 w-4" /> Enter a new customer</>
                  : <><Users className="h-4 w-4" /> Pick from customers</>}
              </Button>
            </div>

            {fromMaster ? (
              <>
                <AsyncCombobox
                  label="Customer *"
                  // The visible label is not tied to the button this
                  // renders, so it needs its own accessible name.
                  aria-label="Customer"
                  placeholder="Search customers"
                  loadOptions={loadCustomers}
                  value={customerId}
                  onChange={setCustomerId}
                />
                <p className="mt-1.5 text-xs text-ink-400">
                  Name, GSTIN and phone come from the master. Anything you type
                  below is used instead, for this quote only.
                </p>
              </>
            ) : (
              <Input
                label="Customer *"
                placeholder="Company name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="Address" placeholder="Where the quotation is going"
                value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              <Input label="Their reference / enquiry no"
                value={customerRef} onChange={(e) => setCustomerRef(e.target.value)} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="GSTIN" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value)} />
              <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
          </Card>

          {/* ── Products ─────────────────────────────────────── */}
          {products.map((p, pi) => {
            const priced = costing.lines.find((l) => l.key === p.key);
            return (
              <Card key={p.key} className="p-5">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">
                    Product {pi + 1}
                    {p.productName.trim() && (
                      <span className="ml-2 font-normal text-ink-400">{p.productName}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => resetRows(p.key)}>
                      <RotateCcw className="h-4 w-4" /> Reset rows
                    </Button>
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(p.key)}
                        aria-label={`Remove product ${pi + 1}`}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Product *" placeholder="e.g. 20mm Woven Elastic"
                    value={p.productName}
                    onChange={(e) => setProduct(p.key, { productName: e.target.value })}
                  />
                  <Input
                    label="Specification" placeholder="Width, elongation, recovery…"
                    value={p.productSpec}
                    onChange={(e) => setProduct(p.key, { productSpec: e.target.value })}
                  />
                </div>

                <p className="mb-1.5 mt-4 text-sm font-medium text-ink-600">
                  Materials in one metre
                  <span className="ml-2 font-normal text-ink-400">
                    weight in grams, rate in rupees per kilogram
                  </span>
                </p>
                <div className="hidden grid-cols-[1fr_100px_110px_110px_32px] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400 sm:grid">
                  <span>Material</span>
                  <span className="text-right">Weight (g)</span>
                  <span className="text-right">Rate (₹/kg)</span>
                  <span className="text-right">Cost / metre</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {p.materials.map((m) => {
                    const cost = priced?.rows.find((r) => r.key === m.key)?.cost ?? 0;
                    return (
                      <div key={m.key} className="grid grid-cols-[1fr_100px_110px_110px_32px] items-start gap-2">
                        <Input
                          aria-label={m.fixed
                            ? `${m.label} name in product ${pi + 1}`
                            : `Material name in product ${pi + 1}`}
                          placeholder="Material"
                          value={m.label}
                          readOnly={m.fixed}
                          onChange={(e) => setRow(p.key, m.key, { label: e.target.value })}
                          className={m.fixed ? "bg-ink-50" : undefined}
                        />
                        <Input
                          type="number" step="0.001" min="0"
                          aria-label={`Weight in grams for ${m.label || "material"} in product ${pi + 1}`}
                          placeholder="0" value={m.weightGrams}
                          onChange={(e) => setRow(p.key, m.key, { weightGrams: e.target.value })}
                        />
                        <Input
                          type="number" step="0.01" min="0"
                          aria-label={`Rate per kilogram for ${m.label || "material"} in product ${pi + 1}`}
                          placeholder="0" value={m.ratePerKg}
                          onChange={(e) => setRow(p.key, m.key, { ratePerKg: e.target.value })}
                        />
                        <div className="flex h-10 items-center justify-end text-sm tabular-nums text-ink-900">
                          ₹{rupees(cost, 4)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(p.key, m.key)}
                          aria-label={`Remove ${m.label || "row"} from product ${pi + 1}`}
                          className="grid h-10 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Button type="button" variant="ghost" size="sm" className="mt-2"
                  onClick={() => addRow(p.key)}>
                  <Plus className="h-4 w-4" /> Add material
                </Button>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Input
                    label="Conversion (₹/m)" type="number" step="0.01" min="0"
                    aria-label={`Conversion cost for product ${pi + 1}`}
                    value={p.conversionCost}
                    onChange={(e) => setProduct(p.key, { conversionCost: e.target.value })}
                  />
                  <Input
                    label="Margin %" type="number" step="0.01" min="0"
                    aria-label={`Margin percent for product ${pi + 1}`}
                    value={p.marginPercent}
                    onChange={(e) => setProduct(p.key, { marginPercent: e.target.value })}
                  />
                  <Input
                    label="Quantity (m)" type="number" step="1" min="0" placeholder="optional"
                    aria-label={`Quantity for product ${pi + 1}`}
                    value={p.quantityMetres}
                    onChange={(e) => setProduct(p.key, { quantityMetres: e.target.value })}
                  />
                </div>

                {priced && (
                  <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <span className="text-ink-600">
                      Cost ₹{rupees(priced.totalCost, 4)}/m
                      <span className="mx-2 text-ink-300">→</span>
                      Rate <span className="font-semibold text-ink-900">₹{rupees(priced.rateBeforeTax)}</span>/m ex-GST
                    </span>
                    {priced.quantityMetres > 0 && (
                      <span className="tabular-nums text-ink-600">
                        {priced.quantityMetres.toLocaleString("en-IN")} m ·{" "}
                        <span className="font-semibold text-ink-900">₹{rupees(priced.valueBeforeTax)}</span>
                      </span>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          <Button type="button" variant="secondary" onClick={addProduct}>
            <Plus className="h-4 w-4" /> Add another product
          </Button>

          {/* ── The document ─────────────────────────────────── */}
          <Card className="p-5">
            <h3 className="mb-4 font-semibold">Quotation details</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Quote date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Valid until" type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
              <Input label="GST %" type="number" step="0.01" min="0"
                value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} />
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-ink-600">Remarks</label>
              <textarea
                aria-label="Remarks"
                rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder="Shown on the quotation"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Margin is a markup on cost — 20% on ₹100 of cost gives ₹120. Each
              product carries its own margin; GST applies to the whole document.
            </p>
          </Card>
        </div>

        {/* ── Running totals ───────────────────────────────── */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h3 className="mb-4 font-semibold">Quotation total</h3>

            <dl className="space-y-2 text-sm">
              {costing.lines.map((l, i) => (
                <div key={l.key} className="flex items-baseline justify-between gap-3">
                  <dt className="truncate text-ink-600">
                    {l.productName.trim() || `Product ${i + 1}`}
                    <span className="ml-1 text-xs text-ink-400">
                      ₹{rupees(l.rateBeforeTax)}/m
                    </span>
                  </dt>
                  <dd className="tabular-nums">₹{rupees(l.valueBeforeTax)}</dd>
                </div>
              ))}

              <div className="border-t border-ink-100 pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">Sub-total</dt>
                  <dd className="font-semibold tabular-nums">₹{rupees(costing.subTotal)}</dd>
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-600">GST @ {rupees(costing.gstPercent, 2)}%</dt>
                <dd className="tabular-nums">₹{rupees(costing.gstAmount)}</dd>
              </div>
              <div className="border-t-2 border-ink-900 pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">Grand total</dt>
                  <dd className="text-xl font-bold tabular-nums">₹{rupees(costing.grandTotal)}</dd>
                </div>
              </div>
            </dl>

            {costing.totalQuantityMetres > 0 && (
              <p className="mt-3 text-xs text-ink-400">
                {costing.totalQuantityMetres.toLocaleString("en-IN")} m across{" "}
                {costing.lines.length} product{costing.lines.length === 1 ? "" : "s"}
              </p>
            )}
            <p className="mt-4 text-xs text-ink-400">
              A product with no quantity still quotes a rate; it just adds
              nothing to the total. The server prices it all again on save.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

export default QuoteCreatePage;
