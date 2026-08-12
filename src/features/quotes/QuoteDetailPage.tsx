import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, Send, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useQuote, useQuoteMutations } from "./hooks";
import { quoteService } from "./api";
import { quoteStatusTone } from "./QuoteListPage";
import { rupees } from "./costing";
import { QuoteStatus } from "./types";

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: quote, isLoading, isError, error } = useQuote(id);
  const { setStatus } = useQuoteMutations();
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const blob = await quoteService.pdfBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not generate the quotation", "error");
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
  if (isError || !quote) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Quotation not found"}
      </p>
    );
  }

  const move = (status: QuoteStatus, msg: string) =>
    setStatus.mutate({ id: quote._id, status }, {
      onSuccess: () => toast(msg, "success"),
      onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
    });

  const expired = new Date(quote.validTill) < new Date();
  const settled = quote.status === "accepted" || quote.status === "cancelled";

  return (
    <>
      <Link to="/quotes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Quotations
      </Link>
      <PageHeader
        title={quote.quoteNo}
        subtitle={`${quote.customerName} · ${quote.productName}`}
        actions={
          <>
            <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
              <FileDown className="h-4 w-4" /> Quotation PDF
            </Button>
            {quote.status === "draft" && (
              <Button onClick={() => move("sent", "Marked as sent")}>
                <Send className="h-4 w-4" /> Mark sent
              </Button>
            )}
            {!settled && (
              <>
                <Button onClick={() => move("accepted", "Quotation accepted")}>
                  <CheckCircle2 className="h-4 w-4" /> Accepted
                </Button>
                <Button variant="secondary" onClick={() => move("declined", "Quotation declined")}>
                  <XCircle className="h-4 w-4" /> Declined
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusChip tone={quoteStatusTone[quote.status]}>{quote.status}</StatusChip>
        {expired && quote.status !== "accepted" && (
          <span className="text-sm text-status-danger">
            Valid until {fmtDate(quote.validTill)} — this price has lapsed
          </span>
        )}
      </div>

      <Card className="mb-4 p-5">
        <DescriptionList
          columns={2}
          items={[
            { label: "Quote date", value: fmtDate(quote.date) },
            { label: "Valid until", value: fmtDate(quote.validTill) },
            { label: "Their reference", value: quote.customerRef || "—" },
            { label: "Specification", value: quote.productSpec || "—" },
          ]}
        />
      </Card>

      {/* ── The costing, as it stood when the price went out ── */}
      <Card className="mb-4">
        <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
          <h3 className="font-semibold">Costing, per metre</h3>
          <p className="text-sm text-ink-400">
            {rupees(quote.totalWeightGrams, 2)} g of material in a metre
          </p>
        </div>
        <p className="px-5 pb-3 pt-1 text-xs text-ink-400">
          Frozen at the moment this quote was raised — it explains the price
          offered, not what the same product would cost today.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2 text-left font-semibold">Material</th>
                <th className="px-5 py-2 text-right font-semibold">Weight (g)</th>
                <th className="px-5 py-2 text-right font-semibold">Rate (₹/kg)</th>
                <th className="px-5 py-2 text-right font-semibold">Cost / m</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(quote.materials ?? []).map((m, i) => (
                <tr key={i}>
                  <td className="px-5 py-2">{m.label}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{rupees(m.weightGrams, 3)}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{rupees(m.ratePerKg, 2)}</td>
                  <td className="px-5 py-2 text-right tabular-nums">₹{rupees(m.cost, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Price build-up</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Materials" value={quote.materialCost} />
            <Row label="Conversion" value={quote.conversionCost} />
            <div className="border-t border-ink-100 pt-2">
              <Row label="Cost per metre" value={quote.totalCost} bold />
            </div>
            <Row label={`Margin @ ${rupees(quote.marginPercent, 2)}%`} value={quote.marginAmount} />
            <div className="border-t border-ink-100 pt-2">
              <Row label="Rate (ex-GST)" value={quote.rateBeforeTax} bold />
            </div>
            <Row label={`GST @ ${rupees(quote.gstPercent, 2)}%`} value={quote.gstAmount} />
            <div className="border-t-2 border-ink-900 pt-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold">Rate inc. GST</dt>
                <dd className="text-xl font-bold tabular-nums">₹{rupees(quote.rateInclTax, 4)}</dd>
              </div>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Quantity quoted</h3>
          {quote.quantityMetres > 0 ? (
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-600">Quantity</dt>
                <dd className="tabular-nums">{quote.quantityMetres.toLocaleString("en-IN")} m</dd>
              </div>
              <Row label="Value (ex-GST)" value={quote.valueBeforeTax} dp={2} />
              <Row label={`GST @ ${rupees(quote.gstPercent, 2)}%`} value={quote.valueInclTax - quote.valueBeforeTax} dp={2} />
              <div className="border-t-2 border-ink-900 pt-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">Total value</dt>
                  <dd className="text-xl font-bold tabular-nums">₹{rupees(quote.valueInclTax)}</dd>
                </div>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-400">
              No quantity was given — this quote states a rate only.
            </p>
          )}
          {quote.remarks && (
            <p className="mt-4 border-t border-ink-100 pt-3 text-sm text-ink-600">
              <span className="font-medium">Remarks:</span> {quote.remarks}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, bold, dp = 4 }: { label: string; value: number; bold?: boolean; dp?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={bold ? "font-semibold" : "text-ink-600"}>{label}</dt>
      <dd className={`tabular-nums ${bold ? "font-semibold" : ""}`}>₹{rupees(value, dp)}</dd>
    </div>
  );
}

export default QuoteDetailPage;
