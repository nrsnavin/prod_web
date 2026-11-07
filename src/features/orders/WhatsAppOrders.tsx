import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { httpClient, ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import type { OrderDraft } from "./OrderForm";

// ══════════════════════════════════════════════════════════════════
//  WHATSAPP ORDERS — what customers typed, read and waiting
//
//  Each shows the message as they wrote it and the lines as read, the
//  ones matched to an elastic and the ones that were not. "Open as
//  order" fills the order form from it for a person to check and save;
//  "Dismiss" when it was not an order. Nothing is ordered from here.
// ══════════════════════════════════════════════════════════════════

export interface OrderRequest {
  _id: string;
  customer: string;
  customerName: string;
  text: string;
  createdAt: string;
  draft: null | {
    poNumber?: string | null;
    deliveryDate?: string | null;
    customer?: { customerId: string | null; customerName: string | null };
    lines: Array<{ description: string; quantity: number | null; unit?: string | null; match: { elasticId: string | null; elasticName: string | null } }>;
  };
}

const KEY = ["orders", "whatsapp-requests"];

export function useOrderRequests() {
  return useQuery({ queryKey: KEY, queryFn: () => httpClient.get<{ success: boolean; requests: OrderRequest[]; count: number }>("/order/requests") });
}

export function useOrderRequestDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, order }: { id: string; action: "converted" | "dismissed"; order?: string }) => httpClient.post(`/order/requests/${id}/${action}`, order ? { order } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** The order form's starting point, from what was read. */
export function draftOf(r: OrderRequest): OrderDraft {
  const d = r.draft;
  return {
    customer: { id: r.customer, name: r.customerName },
    po: d?.poNumber ?? "",
    supplyDate: d?.deliveryDate ?? "",
    description: `From WhatsApp: ${r.text}`.slice(0, 300),
    lines: (d?.lines ?? []).map((l) => ({ elastic: l.match?.elasticId ?? undefined, elasticName: l.match?.elasticName ?? undefined, quantity: l.quantity ?? 0 })),
  };
}

export function WhatsAppOrders({ onOpen }: { onOpen: (r: OrderRequest) => void }) {
  const { toast } = useToast();
  const { data } = useOrderRequests();
  const decide = useOrderRequestDecision();
  const rows = data?.requests ?? [];
  if (!rows.length) return null;
  return (
    <Card className="mb-4 border-status-info/40 p-4" aria-label="WhatsApp orders">
      <h3 className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4 text-status-success" /> WhatsApp orders <StatusChip tone="info">{rows.length}</StatusChip></h3>
      <p className="text-sm text-ink-500">Typed by customers on WhatsApp and read for you. Open one to check it and save it as an order.</p>
      <ul className="mt-3 divide-y divide-ink-100">
        {rows.map((r) => {
          const lines = r.draft?.lines ?? [];
          const unmatched = lines.filter((l) => !l.match?.elasticId).length;
          return (
            <li key={r._id} className="flex flex-wrap items-start gap-3 py-3" aria-label={`WhatsApp order from ${r.customerName}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.customerName} <span className="text-xs font-normal text-ink-400">· {formatDate(r.createdAt)}</span></p>
                <p className="mt-0.5 text-sm italic text-ink-600">“{r.text}”</p>
                {lines.length > 0 ? (
                  <ul className="mt-1 text-xs text-ink-500">
                    {lines.map((l, i) => (
                      <li key={i}>{l.quantity ?? "?"} {l.unit || "m"} · {l.match?.elasticName ? <span className="text-ink-800">{l.match.elasticName}</span> : <span className="text-status-warning">“{l.description}” — pick the elastic</span>}</li>
                    ))}
                  </ul>
                ) : <p className="mt-1 text-xs text-status-warning">Could not read the lines — open it and enter them from the message.</p>}
                {(r.draft?.poNumber || r.draft?.deliveryDate) && <p className="mt-0.5 text-xs text-ink-500">{[r.draft?.poNumber && `PO ${r.draft.poNumber}`, r.draft?.deliveryDate && `wanted by ${formatDate(r.draft.deliveryDate)}`].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => onOpen(r)}>Open as order{unmatched ? ` (${unmatched} to pick)` : ""}</Button>
                <Button size="sm" variant="ghost" aria-label={`Dismiss the message from ${r.customerName}`} loading={decide.isPending}
                  onClick={() => decide.mutate({ id: r._id, action: "dismissed" }, { onSuccess: () => toast("Dismissed", "success"), onError: (e) => toast(e instanceof ApiError ? e.message : "Could not dismiss", "error") })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
