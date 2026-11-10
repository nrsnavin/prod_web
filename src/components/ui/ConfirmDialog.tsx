import { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "./cn";

/** One thing that changes, said in numbers where it can be. */
export interface Consequence {
  text: ReactNode;
  /** warning: worth a second look. info: good to know. */
  tone?: "warning" | "info";
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /**
   * ReactNode, not string: a confirmation for a consequential action
   * has to be able to SHOW the thing being decided — the lines that
   * will be left out, the objection the server raised — rather than
   * summarise it in a sentence and ask the reader to take it on trust.
   */
  message: ReactNode;
  /**
   * What changes, as a short list under the message: "10,500 of 14,000 m
   * have not been produced", "Nothing has been delivered". A dialog that
   * only repeats its button teaches people to click through it.
   */
  consequences?: Consequence[];
  /**
   * Say the act and its object: "Complete order #4", not "Confirm".
   * Required, so a dialog can't fall back to a word that says nothing.
   */
  confirmLabel: string;
  /** Words for the way out; "Cancel" unless that would be ambiguous. */
  cancelLabel?: string;
  danger?: boolean;
  /** Room for content — a list of lines, not just a sentence. */
  wide?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Focus opens on the first button in the body, which is the way out:
// Enter on a dialog that has just appeared never does the dangerous thing.
export function ConfirmDialog({
  open,
  title,
  message,
  consequences,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  wide,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width={wide ? "max-w-lg" : "max-w-sm"}>
      {typeof message === "string" ? (
        <p className="text-sm text-ink-600">{message}</p>
      ) : (
        <div className="text-sm text-ink-600">{message}</div>
      )}
      {consequences && consequences.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {consequences.map((c, i) => {
            const Icon = c.tone === "warning" ? AlertTriangle : Info;
            return (
              <li key={i} className="flex items-start gap-2 text-ink-900">
                <Icon
                  aria-hidden
                  className={cn("mt-0.5 h-4 w-4 shrink-0", c.tone === "warning" ? "text-status-warning" : "text-ink-400")}
                />
                <span>{c.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
