import { useRef } from "react";
import { AlertTriangle, Camera, Info, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Flag } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE PARTS EVERY "READ A PAPER" DIALOG SHARES
//
//  A cheque, a customer's debit note, a TDS challan or certificate, a
//  supplier's quotation, the electricity bill: each is photographed or
//  picked as a PDF, read on the server, and shown back with what the
//  server checked before anything is filled in. These are the picker and
//  the list of checks; each dialog lays out its own result.
// ══════════════════════════════════════════════════════════════════

const ICON = { danger: OctagonAlert, warning: AlertTriangle, info: Info };
const ORDER = { danger: 0, warning: 1, info: 2 };

/** The server's checks on a paper, worst first. */
export function PaperChecks({ checks, label }: { checks: Flag[]; label: string }) {
  if (!checks.length) return null;
  return (
    <ul className="space-y-1 text-sm" aria-label={label}>
      {[...checks].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]).map((c) => {
        const I = ICON[c.severity];
        return (
          <li key={c.code + c.message} className={`flex items-start gap-2 ${c.severity === "danger" ? "text-status-danger" : c.severity === "warning" ? "text-status-warning" : "text-ink-600"}`}>
            <I className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{c.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The file input and its button. A paper can come as a photo or as a PDF
 * someone mailed, so the phone's camera is offered, not forced (`capture`
 * would hide the PDF).
 */
export function PaperPicker({ label, max, busy, onFiles, button = "Take or choose a photo or PDF" }: {
  /** The input's accessible name ("Debit note photo"). */
  label: string; max: number; busy: boolean; onFiles: (files: File[]) => void; button?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple={max > 1} className="hidden" aria-label={label}
        onChange={(e) => { const list = e.target.files ? Array.from(e.target.files).slice(0, max) : []; if (ref.current) ref.current.value = ""; if (list.length) onFiles(list); }} />
      <Button type="button" loading={busy} onClick={() => ref.current?.click()}><Camera className="h-4 w-4" aria-hidden /> {button}</Button>
    </>
  );
}

/** The reader could not make out the paper, or it is some other paper. */
export function ReadProblem({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-center gap-2 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {children}
    </p>
  );
}
