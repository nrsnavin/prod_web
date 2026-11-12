import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { uploadForm } from "@/core/http/upload";

// ══════════════════════════════════════════════════════════════════
//  "Fill from a photo": a photo or PDF sent to a reader route, and what
//  it read handed to the form to fill in. Nothing is saved until the
//  form is. The reader's own "this is not a …" comes back as `problem`.
// ══════════════════════════════════════════════════════════════════

export function PhotoFillButton<T extends { read?: { problem?: string | null } }>({ url, label, what, onRead, multiple = false }: {
  /** The reader route, e.g. "/elastic/read-spec". */
  url: string;
  label: string;
  /** What is being read, for the messages: "tech sheet". */
  what: string;
  onRead: (body: T) => void;
  multiple?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const send = async (files?: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setNote("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files).slice(0, 3)) fd.append("files", f);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await uploadForm<any>(url, fd, `Could not read the ${what}`);
      const problem = body?.read?.problem;
      if (problem) { setNote(problem.startsWith("not_") ? `That does not look like a ${what}.` : `The ${what} could not be read — type the details in.`); return; }
      onRead(body as T);
      setNote(`Filled in from the ${what} — check each field.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : `Could not read the ${what}`);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" multiple={multiple} className="hidden" aria-label={`${what} photo`} onChange={(e) => send(e.target.files)} />
      {/* The label sits in its own span. A button holding only an icon and
          bare text matches the touch rule for icon buttons in index.css
          (CSS cannot see text nodes), which stops it shrinking: a long
          label such as "Fill from the supplier's challan or cone labels"
          then ran past its card on a phone. In a span it wraps to a
          second line instead; leading-4 keeps two lines inside h-8. */}
      <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => ref.current?.click()}><Camera className="h-4 w-4 shrink-0" /><span className="min-w-0 text-left leading-4">{label}</span></Button>
      {note && <span className="text-xs text-ink-500" role="status">{note}</span>}
    </div>
  );
}
