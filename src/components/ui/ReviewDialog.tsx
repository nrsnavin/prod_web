import { ReactNode, useEffect, useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  REVIEW, THEN ACT
//
//  For what can't be taken back: registering an e-invoice with the GST
//  portal, posting a stock count, paying money out, messaging people
//  outside the company, deleting a production record. The dialog shows
//  exactly what will be sent or posted, says plainly what can't be
//  undone, and unlocks the action only after the person has looked:
//  a tick, a reason for the audit trail, or for the riskiest the
//  document number typed in.
//
//  The action button names the act and its object ("Register with the
//  GST portal", "Pay out ₹12,400"), never "Confirm".
// ══════════════════════════════════════════════════════════════════

export interface ReviewRow {
  label: ReactNode;
  value: ReactNode;
  /** A total or the figure that matters most. */
  strong?: boolean;
}

export interface ReviewDialogProps {
  open: boolean;
  title: string;
  intro?: ReactNode;
  rows?: ReviewRow[];
  /** What can't be undone, said plainly. */
  warning?: ReactNode;
  /** A statement the person ticks before the action unlocks. */
  acknowledge?: string;
  /** Ask for a reason, saved to the audit trail. */
  reason?: { minLength?: number; label?: string; placeholder?: string };
  /** The exact text to type to unlock (a document number). */
  typeToConfirm?: string;
  confirmLabel: string;
  /** Keeps the action locked for a reason shown in the dialog (lines still needing a reason, say). */
  disabled?: boolean;
  danger?: boolean;
  loading?: boolean;
  wide?: boolean;
  children?: ReactNode;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function ReviewDialog({
  open,
  title,
  intro,
  rows,
  warning,
  acknowledge,
  reason,
  typeToConfirm,
  confirmLabel,
  disabled,
  danger,
  loading,
  wide,
  children,
  onConfirm,
  onCancel,
}: ReviewDialogProps) {
  const [ticked, setTicked] = useState(false);
  const [why, setWhy] = useState("");
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(false);
  const ids = useId();

  useEffect(() => {
    if (open) {
      setTicked(false);
      setWhy("");
      setTyped("");
      setTried(false);
    }
  }, [open]);

  const minWhy = reason?.minLength ?? 3;
  const whyOk = !reason || why.trim().length >= minWhy;
  const typedOk = !typeToConfirm || typed.trim() === typeToConfirm;
  const tickOk = !acknowledge || ticked;
  const ready = whyOk && typedOk && tickOk;

  return (
    <Modal open={open} onClose={onCancel} title={title} width={wide ? "max-w-xl" : "max-w-lg"} confirmDirtyClose={false}>
      <div className="space-y-4 text-sm">
        {intro && <div className="text-ink-600">{intro}</div>}

        {rows && rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg border border-ink-100 bg-surface-muted px-3.5 py-3 tabular-nums">
            {rows.map((r, i) => (
              <div key={i} className="contents">
                <dt className={cn("text-ink-400", r.strong && "font-semibold text-ink-900")}>{r.label}</dt>
                <dd className={cn("text-right text-ink-900", r.strong && "font-semibold")}>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}

        {warning && (
          <div className="flex items-start gap-2 rounded-lg bg-status-warningBg p-3 text-status-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>{warning}</div>
          </div>
        )}

        {reason && (
          <div>
            <label htmlFor={`${ids}-why`} className="mb-1.5 block font-medium text-ink-600">
              {reason.label ?? "Reason"}
            </label>
            <textarea
              id={`${ids}-why`}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={2}
              placeholder={reason.placeholder ?? "Saved to the audit trail"}
              aria-invalid={tried && !whyOk}
              className={cn(
                "w-full rounded-lg border bg-surface px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
                tried && !whyOk ? "border-status-danger" : "border-ink-200"
              )}
            />
            <p className={cn("mt-1 text-xs", tried && !whyOk ? "text-status-danger" : "text-ink-400")}>
              {tried && !whyOk ? `Give a reason of at least ${minWhy} characters.` : "Saved to the audit trail with your name."}
            </p>
          </div>
        )}

        {typeToConfirm && (
          <div>
            <label htmlFor={`${ids}-type`} className="mb-1.5 block font-medium text-ink-600">
              Type <span className="font-mono text-ink-900">{typeToConfirm}</span> to confirm
            </label>
            <input
              id={`${ids}-type`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-lg border border-ink-200 bg-surface px-3 font-mono outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        )}

        {acknowledge && (
          <label className="flex items-start gap-2.5 text-ink-900">
            <input
              type="checkbox"
              checked={ticked}
              onChange={(e) => setTicked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
            />
            <span>{acknowledge}</span>
          </label>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Not now
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            loading={loading}
            disabled={disabled || !tickOk || !typedOk}
            onClick={() => {
              if (!ready) {
                setTried(true);
                return;
              }
              onConfirm(reason ? why.trim() : undefined);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
