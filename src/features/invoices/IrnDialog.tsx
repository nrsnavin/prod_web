import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { IrnPasteBody } from "./types";

const IRN_RE = /^[0-9a-f]{64}$/i;

/**
 * The IRN as the e-invoice portal (or the accountant's GSP console)
 * handed it back, pasted in. The other door, for when no GSP is
 * connected in Settings → Invoice.
 */
export function IrnDialog({
  invoiceNumber,
  loading,
  onClose,
  onConfirm,
}: {
  invoiceNumber: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (body: IrnPasteBody) => void;
}) {
  const [irn, setIrn] = useState("");
  const [ackNo, setAckNo] = useState("");
  const [ackDate, setAckDate] = useState("");
  const [signedQr, setSignedQr] = useState("");
  const ok = IRN_RE.test(irn.trim());

  return (
    <Modal open onClose={onClose} title={`Paste the IRN for ${invoiceNumber}`} width="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          Register the invoice on the e-invoice portal (upload its JSON from the Download menu), then paste what the
          portal returns. The signed QR is printed on the invoice.
        </p>
        <Input
          label="IRN"
          value={irn}
          onChange={(e) => setIrn(e.target.value)}
          placeholder="64 characters"
          error={irn && !ok ? "An IRN is 64 hexadecimal characters" : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ack no." value={ackNo} onChange={(e) => setAckNo(e.target.value)} />
          <Input label="Ack date" type="datetime-local" value={ackDate} onChange={(e) => setAckDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="irn-signed-qr" className="mb-1.5 block text-sm font-medium text-ink-600">
            Signed QR code
          </label>
          <textarea
            id="irn-signed-qr"
            rows={4}
            value={signedQr}
            onChange={(e) => setSignedQr(e.target.value)}
            placeholder="The SignedQRCode string from the portal's response"
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 font-mono text-xs text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!ok}
            loading={loading}
            onClick={() =>
              onConfirm({
                irn: irn.trim(),
                ackNo: ackNo.trim() || undefined,
                ackDate: ackDate ? new Date(ackDate).toISOString() : undefined,
                signedQr: signedQr.trim() || undefined,
              })
            }
          >
            Save IRN
          </Button>
        </div>
      </div>
    </Modal>
  );
}
