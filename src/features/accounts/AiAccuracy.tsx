import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";

const LABEL: Record<string, string> = { "bill-ocr": "Bill photo to draft", "bank-statement-match": "Bank statement matching", "collection-reminder": "Collection reminders" };
const FIELD: Record<string, string> = { "lines[].rate": "line rates", "lines[].quantity": "quantities", "lines[].description": "descriptions", "lines[].gstPercent": "GST rates", "lines[].hsn": "HSN codes", billNo: "bill numbers", billDate: "bill dates", supplierGstin: "GSTINs", "totals.grand": "totals", "totals.taxable": "taxable values" };

/** How often the AI's drafts are kept as read, and what people correct most. */
export function AiAccuracy() {
  const { data } = useQuery({ queryKey: [ACCOUNTS_KEY, "ai-stats"], queryFn: accountsService.aiStats, staleTime: 300_000 });
  if (!data || !data.surfaces.length) return null;
  return (
    <Card className="p-5 lg:col-span-2">
      <h3 className="font-semibold">How the AI is doing (last {data.days} days)</h3>
      <ul className="mt-2 grid gap-3 sm:grid-cols-3 text-sm">
        {data.surfaces.map((s) => {
          const decided = (s.accepted ?? 0) + (s.edited ?? 0) + (s.rejected ?? 0);
          return (
            <li key={s.surface} className="rounded-lg border border-ink-100 p-3">
              <p className="font-medium">{LABEL[s.surface] ?? s.surface}</p>
              <p className="text-ink-500">{s.total ?? decided} drafts{decided ? ` · ${Math.round(((s.accepted ?? 0) / decided) * 100)}% kept as read, ${s.edited ?? 0} corrected` : ""}{s.failed ? ` · ${s.failed} failed` : ""}</p>
            </li>
          );
        })}
      </ul>
      {data.weakFields.length > 0 && (
        <p className="mt-2 text-sm text-ink-500">Most often corrected on scanned bills: {data.weakFields.map((w) => `${FIELD[w.field] ?? w.field} (${w.suggestions})`).join(", ")}.</p>
      )}
    </Card>
  );
}
