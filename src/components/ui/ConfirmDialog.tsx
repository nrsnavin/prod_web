import { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

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
  confirmLabel?: string;
  danger?: boolean;
  /** Room for content — a list of lines, not just a sentence. */
  wide?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
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
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
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
