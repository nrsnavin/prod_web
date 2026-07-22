import { useEffect, useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { StockShortfall } from "./types";

export interface ForceApprovalDialogProps {
  open: boolean;
  /** Structured shortfall the backend returned on the INSUFFICIENT_STOCK 400. */
  shortfall: StockShortfall | null;
  /** The backend's original message, shown above the shortfall card. */
  originalMessage?: string;
  loading?: boolean;
  onClose: () => void;
  /** Called with the trimmed reason (>= 8 chars) when the admin confirms. */
  onConfirm: (reason: string) => void;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// Shown when a plain approve is rejected with code INSUFFICIENT_STOCK.
// Mirrors the Flutter admin app's force-approval prompt: it surfaces the
// exact shortfall and demands a reason before letting the admin override
// the stock guard. Forcing deducts what is available (remainder clamped
// at 0) and records the override in the order audit trail.
export function ForceApprovalDialog({
  open,
  shortfall,
  originalMessage,
  loading,
  onClose,
  onConfirm,
}: ForceApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setTouched(false); }
  }, [open]);

  const tooShort = reason.trim().length < 8;

  const available = shortfall?.available ?? 0;
  const required = shortfall?.required ?? 0;
  const short = shortfall?.short ?? required - available;

  return (
    <Modal open={open} onClose={onClose} title="Insufficient stock" width="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-status-dangerBg p-3 text-sm text-status-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {originalMessage || "Raw-material stock is short of the order requirement."}
          </span>
        </div>

        {shortfall && (
          <div className="rounded-lg border border-status-warning/40 bg-status-warningBg p-3">
            <p className="text-sm font-semibold text-ink-900">{shortfall.materialName}</p>
            <p className="mt-1 text-xs font-medium text-ink-600">
              Need {fmt(required)} kg · Available {fmt(available)} kg · Short {fmt(short)} kg
            </p>
          </div>
        )}

        <p className="text-xs text-ink-400">
          Forcing approval will deduct what is available (remaining clamped at 0)
          and record the override in the order audit trail. Provide a reason so the
          next reviewer can understand the call.
        </p>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            autoFocus
            placeholder="e.g. New stock arriving tomorrow morning"
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm outline-none",
              "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
              touched && tooShort ? "border-status-danger" : "border-ink-200"
            )}
          />
          {touched && tooShort && (
            <p className="mt-1 text-xs text-status-danger">Reason must be at least 8 characters.</p>
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
            <Zap className="h-4 w-4" /> Force approve
          </Button>
        </div>
      </div>
    </Modal>
  );
}
