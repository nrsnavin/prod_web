import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "./cn";

export interface ReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
  loading?: boolean;
  /**
   * Shortest reason this caller will accept. Defaults to 3.
   *
   * Set it to whatever the route enforces: a dialog that accepts a
   * reason the server then rejects sends the user round a trip to be
   * told something the form already knew.
   */
  minLength?: number;
}

// Shared confirm-with-reason dialog. Every edit/delete that records an
// audit fingerprint routes through this so a reason is always captured.
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  loading,
  minLength = 3,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setTouched(false); }
  }, [open]);

  const tooShort = reason.trim().length < minLength;

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md" confirmDirtyClose={false}>
      <div className="space-y-4">
        {tone === "danger" && (
          <div className="flex items-start gap-2 rounded-lg bg-status-dangerBg p-3 text-sm text-status-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{description || "This action is recorded in the audit trail and cannot be undone."}</span>
          </div>
        )}
        {tone === "default" && description && (
          <p className="text-sm text-ink-600">{description}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            autoFocus
            placeholder="Why is this change being made? (recorded in the audit log)"
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm outline-none",
              "focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
              touched && tooShort ? "border-status-danger" : "border-ink-200"
            )}
          />
          {touched && tooShort && (
            <p className="mt-1 text-xs text-status-danger">Please give a brief reason (min 3 characters).</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            loading={loading}
            onClick={() => {
              if (tooShort) { setTouched(true); return; }
              onConfirm(reason.trim());
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
