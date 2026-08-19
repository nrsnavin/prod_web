import { createPortal } from "react-dom";
import { PrintModal } from "@/components/print/PrintModal";
import { QrImg } from "@/components/print/QrImg";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A 2" × 2" LABEL: THE CODE, AND THE JOB NUMBER
//
//  This was a full job card — customer, machine, warping and covering
//  status, a table of planned against produced against packed. That is
//  a sheet of A4, and A4 does not go on a beam, a trolley or a bin.
//  What actually gets stuck to the work is a 2in square label off a
//  label printer, and on 2in there is room for exactly two things:
//  the code, and the number a person reads when the code will not scan.
//
//  Everything else that was on the card is one scan away, which is the
//  entire point of the code being there.
//
//  ── Why the QR holds a URL and not an id ─────────────────────────
//  The other QR codes in this system encode tagged strings — `BOX|<id>`
//  on a packing slip, `COVB|J:12|C:…|B:3` on a covering label. Those
//  assume a scanner that knows the format, and there isn't one: neither
//  mobile app has a scanner, in either repo. Every QR printed here so
//  far has been unreadable by anything.
//
//  A URL needs no scanner. Every phone camera made in the last decade
//  opens one from the lock screen. So this encodes the job's own page
//  on whatever host the sheet was printed from — print from the office
//  machine and it points at the office host; print from the public one
//  and it points there. Nothing to configure and nothing to keep in
//  step with a deployment.
//
//  ── Why this is portalled to <body> ──────────────────────────────
//  The app's print rules hide everything outside `.print-area` with
//  `visibility: hidden`, which leaves it OCCUPYING LAYOUT. On A4 that
//  costs a leading blank page nobody notices. On a 2in page it is a
//  stack of blank labels feeding out of the printer, one for every 2in
//  of app screen behind the dialog.
//
//  So the label is portalled to <body> as a top-level branch, and the
//  print stylesheet takes every other top-level branch out of the
//  layout with `display: none` rather than merely hiding it. That rule
//  needs a direct child of <body> to bite on; a dialog buried inside
//  #root cannot give it one.
// ══════════════════════════════════════════════════════════════════

/**
 * The page box, for as long as the label is open.
 *
 * `@page` is document-level — it cannot be scoped to a selector — so it
 * is scoped by LIFETIME instead: this rule exists only while the label
 * sheet is mounted, and the app's A4 default applies again the moment
 * it closes. It comes after index.css in the cascade, so it wins.
 */
export const LABEL_PAGE_CSS = "@page { size: 2in 2in; margin: 0; }";

/**
 * The QR, in CSS pixels. 2in of paper is 192px at the 96dpi CSS inch;
 * this leaves the 0.1in padding, the job number beneath, and quiet zone
 * on either side of the code.
 */
export const QR_PX = 134;

/**
 * The quiet zone, in modules, encoded into the image itself.
 *
 * Four is what the QR spec asks for and what readers use to find the
 * symbol's edges. It is a count of MODULES, not a distance, which is
 * why it cannot be left to the CSS padding: a module shrinks as the
 * host name grows, so a padding that clears four modules on
 * `http://mill.local` clears fewer on a longer domain.
 */
export const QR_QUIET_MODULES = 4;

/**
 * The page this job lives on, on the host the sheet is being printed
 * from.
 *
 * Read off `window.location` rather than from config: the app is served
 * from more than one host (dev, the LAN box, the public domain) and a
 * baked-in URL would send somebody scanning in the mill to a machine
 * they cannot reach.
 */
export function jobUrl(jobId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  return `${origin}/jobs/${jobId}`;
}

export function JobQrPrint({
  job, open, onClose,
}: { job: JobDetail; open: boolean; onClose: () => void }) {
  // Nothing is built while the sheet is closed. PrintModal returns null
  // when `open` is false, but its CHILDREN are evaluated before it gets
  // to decide that — so without this early return the whole sheet is
  // constructed on every render of the job page, and any fault in it
  // takes the page down rather than the print preview. That is not
  // hypothetical: the existing job-detail tests caught exactly this.
  if (!open) return null;

  const url = jobUrl(job.id);

  const sheet = (
    <div data-print-page="label-2in">
      <style>{LABEL_PAGE_CSS}</style>

      <PrintModal open={open} onClose={onClose} title={`Job label — ${job.jobNo}`}>
        {/* Shown at its true size on screen, so what is on the preview
            is what comes off the printer. The dashed edge is a preview
            aid only — on paper the label is the code and the number and
            nothing else. */}
        <div className="flex justify-center">
          {/* Every metric of this box — 2in square, the padding that is
              the code's quiet zone, the gap above the number — is in
              `.print-label-2in` in index.css, NOT in Tailwind arbitrary
              values here. `p-[0.1in]` and `gap-[0.07in]` were dropped by
              the extractor at build time without a word, and the label
              rendered at the right size with the code flush against the
              paper edge. */}
          <div className="print-label print-label-2in flex flex-col items-center justify-center border border-dashed border-ink-300 bg-white">
            {/* The 4-module quiet zone is encoded INTO the image rather
                than left to the 0.1in padding round it. The padding is
                a fixed distance; the quiet zone has to be four modules
                wide, and a module gets smaller as the host name gets
                longer. Asking the encoder makes it right at any URL
                length instead of right at the one I measured. */}
            <QrImg value={url} size={QR_PX} margin={QR_QUIET_MODULES} />

            {/* The one thing on the label that survives a smudged code,
                a flat battery, or a camera that will not focus in mill
                light. It is printed big enough to read at arm's length
                off a machine. */}
            <span className="text-[13pt] font-bold leading-none tracking-wide text-ink-900">
              {job.jobNo}
            </span>
          </div>
        </div>
      </PrintModal>
    </div>
  );

  return createPortal(sheet, document.body);
}

export default JobQrPrint;
