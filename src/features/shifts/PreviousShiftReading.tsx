import { useState } from "react";
import { Camera, History, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { usePhotoUrl } from "./TimerPhotos";
import type { PreviousReading } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHAT THE LOOM'S TIMER READ THE SHIFT BEFORE
//
//  Beside an entry awaiting verification: the run time the same loom
//  submitted the shift before — verified, or still pending like this
//  one — and the photo of the display it was read from. The run time
//  submitted now is checked against where the display started.
//  Compact on the list card; with the photo, enlargeable, on the
//  verify screen.
// ══════════════════════════════════════════════════════════════════

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** The figure to show: the run time as it stands, else what the photo read. */
export function previousFigure(p: PreviousReading): string | null {
  return p.runTime ?? p.photo?.runTimeUsed ?? p.photo?.readText ?? null;
}

function Photo({ photoId, label, className, onClick }: { photoId: string; label: string; className?: string; onClick?: () => void }) {
  const { url, isError } = usePhotoUrl(photoId);
  const img = url ? (
    <img src={url} alt={label} className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full items-center justify-center text-[10px] text-ink-400">{isError ? "Unavailable" : "…"}</span>
  );
  if (!onClick) return <span className={cn("block overflow-hidden rounded-md border border-ink-200 bg-ink-100", className)}>{img}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={`Open the ${label.toLowerCase()}`} className={cn("block overflow-hidden rounded-md border border-ink-200 bg-ink-100", className)}>
      {img}
    </button>
  );
}

function Enlarged({ p, onClose }: { p: PreviousReading & { photo: NonNullable<PreviousReading["photo"]> }; onClose: () => void }) {
  const { url } = usePhotoUrl(p.photo.id);
  return (
    <figure className="space-y-1.5 rounded-lg border border-ink-200 bg-ink-50/60 p-2">
      <div className="flex items-start justify-between gap-2">
        <figcaption className="text-xs text-ink-600">
          <span className="font-medium text-ink-900">Timer at the end of the {p.shift.label.toLowerCase()}</span>
          <br />
          Taken {when(p.photo.takenAt)}
          {p.photo.byName ? ` by ${p.photo.byName}` : ""}
        </figcaption>
        <button type="button" onClick={onClose} aria-label="Close the photo" className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      {url && <img src={url} alt="The loom's timer the shift before, full size" className="max-h-[60vh] w-full rounded-md object-contain" />}
    </figure>
  );
}

/**
 * `compact`: one line for the list card. Otherwise a block with the
 * photo, for the verify screen. Nothing when the entry has no shift
 * before to look at (`previous` null or undefined).
 */
export function PreviousShiftReading({ previous, compact = false }: { previous: PreviousReading | null | undefined; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!previous) return null;
  const p = previous;
  const figure = previousFigure(p);
  const photoLabel = `Timer photo from the ${p.shift.label}`;
  const status = p.runTime == null ? null : p.verified ? "verified" : "not verified yet";

  if (compact) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500" aria-label="Timer the shift before">
        {p.photo ? (
          <Photo photoId={p.photo.id} label={photoLabel} className="h-8 w-8 shrink-0" />
        ) : (
          <History className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />
        )}
        <span className="min-w-0 truncate">
          Shift before{p.operator ? ` (${p.operator})` : ""}:{" "}
          {figure ? (
            <>
              timer <span className="font-semibold tabular-nums text-ink-700">{figure}</span>
              {status && <span className={status === "verified" ? "" : " text-status-warning"}> · {status}</span>}
            </>
          ) : p.operator ? (
            "no run time entered"
          ) : (
            "loom not on that shift"
          )}
        </span>
      </p>
    );
  }

  return (
    <section aria-label="Timer the shift before" className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-600">
        <History className="h-4 w-4" aria-hidden /> Shift before · {p.shift.label}
      </p>
      <div className="flex gap-3 rounded-lg border border-ink-200 bg-surface-muted p-3 text-sm">
        {p.photo ? (
          <Photo photoId={p.photo.id} label={photoLabel} className="h-20 w-20 shrink-0" onClick={() => setOpen((o) => !o)} />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-dashed border-ink-200 text-ink-300">
            <Camera className="h-6 w-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          {figure ? (
            <p className="text-ink-600">
              Timer read <span className="font-semibold tabular-nums text-ink-900">{figure}</span>
              {p.operator ? ` · ${p.operator}` : ""}
            </p>
          ) : (
            <p className="text-ink-600">{p.operator ? `No run time was entered${p.operator ? ` · ${p.operator}` : ""}.` : "This loom was not on that shift."}</p>
          )}
          {status && (
            <p className={cn("text-xs", status === "verified" ? "text-status-success" : "text-status-warning")}>
              {status === "verified" ? "Verified by the office." : "Not verified yet — the figure is as the floor submitted it."}
            </p>
          )}
          {p.photo ? (
            <p className="text-xs text-ink-400">
              Photo{p.photo.byName ? ` by ${p.photo.byName}` : ""} at {when(p.photo.takenAt)}
              {p.photo.used ? " · used for the run time" : ""}
            </p>
          ) : (
            p.operator && <p className="text-xs text-ink-400">No timer photo was taken.</p>
          )}
        </div>
      </div>
      {open && p.photo && <Enlarged p={{ ...p, photo: p.photo }} onClose={() => setOpen(false)} />}
    </section>
  );
}
