import { useEffect, useState } from "react";
import { AlertTriangle, Truck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { DcStockShort } from "./types";

const DEFAULT_MIN_REASON = 8;

/**
 * The shortfall a challan was refused for, or null if `e` is any other error.
 *
 * The server refuses a challan that ships more than is on the shelf
 * (409 DC_STOCK_SHORT) unless it carries a reason; this reads what it
 * said was short so the prompt can show it.
 */
export function stockShortFrom(e: unknown): (DcStockShort & { message: string }) | null {
  if (!(e instanceof ApiError) || e.code !== "DC_STOCK_SHORT") return null;
  const details = (e.data?.details ?? {}) as Partial<DcStockShort>;
  return {
    shortfalls: Array.isArray(details.shortfalls) ? details.shortfalls : [],
    minReasonLength: Number(details.minReasonLength) || DEFAULT_MIN_REASON,
    message: e.message,
  };
}

function fmt(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toFixed(2);
}

export interface StockShortDialogProps {
  open: boolean;
  short: (DcStockShort & { message?: string }) | null;
  loading?: boolean;
  onClose: () => void;
  /** Called with the trimmed reason when the user confirms. */
  onConfirm: (reason: string) => void;
}

// Shown when a challan is refused for shipping more than is in stock.
// Same shape as the order force-approve prompt: say exactly what is
// short, and ask why before sending it anyway. The reason is kept on
// the challan, so whoever reconciles the stock later can see the call.
export function StockShortDialog({ open, short, loading, onClose, onConfirm }: StockShortDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setTouched(false); }
  }, [open]);

  const min = short?.minReasonLength ?? DEFAULT_MIN_REASON;
  const tooShort = reason.trim().length < min;
  const lines = short?.shortfalls ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Not enough in stock" width="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-status-dangerBg p-3 text-sm text-status-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This challan ships more than the stock shows on hand.</span>
        </div>

        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={`${l.elastic ?? l.name ?? ""}-${i}`} className="rounded-lg border border-status-warning/40 bg-status-warningBg p-3">
                <p className="text-sm font-semibold text-ink-900">{l.name || "Elastic"}</p>
                <p className="mt-1 text-xs font-medium tabular-nums text-ink-600">
                  Shipping {fmt(l.shipping)} · In stock {fmt(l.onHand)} · Short {fmt(l.short)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-ink-400">
          Sending it anyway takes out what is in stock (it does not go below zero)
          and keeps your reason on the challan.
        </p>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason *</label>
          <textarea
            aria-label="Reason for sending more than is in stock"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            autoFocus
            placeholder="e.g. Packed this morning, packing entry not made yet"
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm outline-none",
              "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
              touched && tooShort ? "border-status-danger" : "border-ink-200"
            )}
          />
          {touched && tooShort && (
            <p className="mt-1 text-xs text-status-danger">Reason must be at least {min} characters.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={loading}
            onClick={() => {
              if (tooShort) { setTouched(true); return; }
              onConfirm(reason.trim());
            }}
          >
            <Truck className="h-4 w-4" /> Send anyway
          </Button>
        </div>
      </div>
    </Modal>
  );
}
