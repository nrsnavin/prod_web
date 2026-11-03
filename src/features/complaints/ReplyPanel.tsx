import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircle, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { complaintService, type ReplyDraft } from "./api";

/** wa.me wants the number with its country code and no "+"; a 10-digit Indian mobile gets 91. */
export function waNumber(phone: string) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith("91")) return d;
  return d.length >= 11 ? d : "";
}

/**
 * A reply to the customer, drafted from the complaint, its resolution and
 * what the trace found — to edit, then copy or open in WhatsApp. "Mark as
 * sent" keeps it on the complaint's notes.
 */
export function ReplyPanel({ complaintId }: { complaintId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await complaintService.replyDraft(complaintId);
      setDraft(d); setText(d.text);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not draft a reply", "error");
    } finally {
      setLoading(false);
    }
  };
  const sent = useMutation({
    mutationFn: () => complaintService.replySent(complaintId, { text, aiSuggestion: draft?.aiSuggestion }),
    onSuccess: () => { toast("Kept on the complaint's notes", "success"); qc.invalidateQueries({ queryKey: ["complaints"] }); setDraft(null); setText(""); },
    onError: () => toast("Could not save that", "error"),
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast("Copied", "success"); } catch { toast("Copy did not work — select the text instead", "error"); }
  };
  const wa = draft ? waNumber(draft.phone) : "";

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Reply to the customer</h2>
        <Button size="sm" variant="secondary" loading={loading} onClick={load}><Sparkles className="h-4 w-4" /> {draft ? "Draft again" : "Draft a reply"}</Button>
      </div>
      {draft ? (
        <div className="mt-3 space-y-2">
          <textarea aria-label="Reply" rows={7} value={text} onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm" />
          <p className="text-xs text-ink-400">{draft.aiGenerated ? "Drafted by AI from the complaint and its resolution — read it before it goes." : "A plain draft from the complaint and its resolution."} It promises nothing the resolution does not say.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={copy}><Copy className="h-4 w-4" /> Copy</Button>
            {wa && <a className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Open in WhatsApp</a>}
            <Button size="sm" loading={sent.isPending} disabled={text.trim().length < 10} onClick={() => sent.mutate()}>Mark as sent</Button>
          </div>
        </div>
      ) : <p className="mt-2 text-sm text-ink-400">Write the resolution first: the reply says only what it says.</p>}
    </Card>
  );
}
