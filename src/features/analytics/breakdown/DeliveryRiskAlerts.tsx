import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MessageCircle, Copy, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { breakdownService } from "./api";
import { DeliveryRisk } from "./types";

function fmt(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

// wa.me needs a country-coded, digits-only number. Indian 10-digit
// numbers get a 91 prefix; anything already longer is left as-is.
function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  if (digits.length < 11) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function DeliveryRiskAlerts() {
  const { toast } = useToast();
  const { data } = useQuery({
    queryKey: ["eta-risks"],
    queryFn: () => breakdownService.etaRisks(),
    staleTime: 60_000,
  });
  const risks: DeliveryRisk[] = data?.risks ?? [];
  if (risks.length === 0) return null;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast("Message copied", "success"),
      () => toast("Couldn't copy", "error")
    );
  };

  return (
    <Card className="border-l-4 border-status-danger p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-status-danger">
        <AlertTriangle className="h-4 w-4" />
        {risks.length} order{risks.length === 1 ? "" : "s"} predicted late — draft customer updates ready
      </p>

      <div className="mt-3 space-y-3">
        {risks.map((r) => {
          const link = waLink(r.customer.phone, r.draft);
          return (
            <div key={r.orderId} className="rounded-lg border border-ink-100 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/orders/${r.orderId}`} className="font-semibold hover:text-brand-600">
                  Order #{r.orderNo}
                </Link>
                <span className="text-sm text-ink-500">{r.customer.name}</span>
                <StatusChip tone="danger">{r.lateWorkingDays}d late</StatusChip>
                <span className="text-xs text-ink-400">
                  promised {fmt(r.promised)} → predicted {fmt(r.expectedDate)}
                </span>
              </div>

              <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-700">{r.draft}</p>

              <div className="mt-2 flex items-center gap-2">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-ink-400">No customer phone on file</span>
                )}
                <button
                  onClick={() => copy(r.draft)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm hover:border-ink-400"
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
                <Link
                  to={`/orders/${r.orderId}`}
                  className="ml-auto inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"
                >
                  Order <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-400">
        You review and send each message — nothing goes out automatically.
      </p>
    </Card>
  );
}
