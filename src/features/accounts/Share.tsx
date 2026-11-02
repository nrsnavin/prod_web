import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { accountsService } from "./api";

type What = { kind: "payment" | "note"; id: string } | { kind: "statement"; partyType: "customer" | "supplier"; party: string; from?: string; to?: string };

/**
 * The WhatsApp message that goes with a receipt, a payment advice, a
 * note or a statement: drafted on the server from the figures, edited
 * here, sent through the same WhatsApp line as collection reminders.
 */
export function ShareDialog({ what, customer, onClose }: { what: What; customer?: string; onClose: () => void }) {
  const { toast } = useToast();
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    let live = true;
    accountsService.shareDraft(what).then((d) => { if (live) { setTo(d.to); setMessage(d.message); } })
      .catch((e) => toast(e instanceof ApiError ? e.message : "Could not draft the message", "error"))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const send = async () => {
    setSending(true);
    try {
      const r = await accountsService.sendReminder(to, message, customer ? { customer } : {});
      toast(r.sent ? "Sent on WhatsApp" : r.dryRun ? "WhatsApp is not set up — logged, not sent" : r.error || "Not sent", r.sent ? "success" : "info");
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not send", "error");
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Send on WhatsApp" width="max-w-xl">
      {loading ? <Skeleton className="h-40 w-full" /> : (
        <div className="space-y-3">
          <Input label="To" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91…" />
          <label className="block text-sm">
            <span className="font-medium text-ink-700">Message</span>
            <textarea aria-label="Message" className="mt-1 h-56 w-full rounded-lg border border-ink-200 p-2 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={send} loading={sending} disabled={!to || message.trim().length < 20}><MessageCircle className="h-4 w-4" /> Send</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
