import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { cn } from "@/components/ui/cn";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  WORTH A SECOND LOOK
//
//  From the whole trail, the changes that are either mistakes or how
//  money and stock go missing: cancellations, deletions, production
//  edited after verifying, back-dated money documents, late-night work,
//  stock and login changes. The owner gets the same list each Monday.
// ══════════════════════════════════════════════════════════════════

export interface WatchItem {
  kind: string; severity: "check" | "info"; title: string; detail: string; at: string; actor: string;
  entityType: string | null; entityId: string | null; entityNo: string | number | null;
}
interface WatchData { from: string; to: string; counts: Record<string, number>; total: number; toLookAt: number; items: WatchItem[] }

const KIND: Record<string, string> = {
  cancelled: "Cancelled", deleted: "Deleted", edited: "Edited after verifying", backdated: "Back-dated",
  "late-night": "Late at night", stock: "Stock", access: "Logins",
};
const PATH: Record<string, (id: string) => string> = {
  Order: (id) => `/orders/${id}`, JobOrder: (id) => `/jobs/${id}`, PurchaseOrder: (id) => `/purchase-orders/${id}`,
  DeliveryChallan: (id) => `/delivery-challans/${id}`, Invoice: (id) => `/invoices/${id}`, Quote: (id) => `/quotes/${id}`, StockCount: (id) => `/stock-counts/${id}`,
};

export function AuditWatchPanel() {
  const [days, setDays] = useState("7");
  const [kind, setKind] = useState("all");
  const { data } = useQuery({
    queryKey: ["audit", "watch", days],
    queryFn: async () => (await httpClient.get<{ data: WatchData }>("/audit/watch", { days })).data,
  });
  if (!data) return null;
  const items = kind === "all" ? data.items : data.items.filter((i) => i.kind === kind);

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-brand-500" />
          <h3 className="font-semibold">{data.toLookAt ? `${data.toLookAt} change${data.toLookAt === 1 ? "" : "s"} worth a second look` : "Nothing unusual"}</h3>
        </div>
        <FilterChips options={[{ value: "7", label: "This week" }, { value: "31", label: "This month" }]} value={days} onChange={setDays} />
      </div>
      {data.total > 0 && (
        <>
          <div className="mt-2">
            <FilterChips
              options={[{ value: "all", label: `All ${data.total}` }, ...Object.entries(data.counts).map(([k, n]) => ({ value: k, label: `${KIND[k] ?? k} ${n}` }))]}
              value={kind}
              onChange={setKind}
            />
          </div>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {items.slice(0, 40).map((i, n) => {
              const href = i.entityType && i.entityId && PATH[i.entityType] ? PATH[i.entityType](i.entityId) : null;
              return (
                <li key={n} className="py-1.5">
                  <span className={cn("mr-2 text-xs font-medium uppercase", i.severity === "check" ? "text-status-warning" : "text-ink-400")}>{KIND[i.kind] ?? i.kind}</span>
                  {href ? <Link to={href} className="text-brand-600 hover:underline">{i.title}</Link> : <span>{i.title}</span>}
                  <span className="text-ink-500"> — {i.actor} · {new Date(i.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  {i.detail && <p className="text-xs text-ink-500">{i.detail}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
