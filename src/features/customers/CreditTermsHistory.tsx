import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { httpClient } from "@/core/http/httpClient";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/core/format/date";

/** Mirrors GET /customer/:id/credit-terms (prod/api/customer.js). */
interface CreditTermsData {
  terms: Record<string, number | string | null>;
  history: { at: string; by: string; detail: string }[];
}

/**
 * Every change made to this customer's credit terms — the limit, the
 * overdue days allowed, the payment and interest terms: when, by whom,
 * from what to what.
 *
 * Shown only when there is something to show. A customer whose terms
 * nobody has changed since changes were kept has no card, and neither
 * does a page talking to a server that does not keep them yet.
 */
export function CreditTermsHistory({ customerId }: { customerId: string }) {
  const { data } = useQuery({
    queryKey: ["customer-credit-terms", customerId],
    queryFn: () => httpClient.get<CreditTermsData & { success: boolean }>(`/customer/${customerId}/credit-terms`),
    retry: false,
    staleTime: 30_000,
  });
  const history = data?.history ?? [];
  if (history.length === 0) return null;

  return (
    <Card className="mb-4 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-ink-400" aria-hidden />
        <h3 className="text-sm font-semibold">Credit terms: changes</h3>
      </div>
      <ul className="mt-2 divide-y divide-ink-100 text-sm">
        {history.map((h, n) => (
          <li key={n} className="py-1.5">
            <p>{h.detail}</p>
            <p className="text-xs text-ink-500">{formatDate(h.at)} · {h.by}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
