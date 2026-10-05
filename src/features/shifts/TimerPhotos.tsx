import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, X } from "lucide-react";
import { httpClient } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";

// ══════════════════════════════════════════════════════════════════
//  THE TIMER PHOTOS TAKEN FOR A SHIFT
//
//  On the verify screen: every photo of the loom's timer taken while the
//  shift's production was entered (kept by api/timerOcr.js), newest
//  first, with what was read off each and which one the run time was
//  filled from. Tap one to see it full size and check the run time
//  against the display itself. Shows nothing when no photo was taken.
// ══════════════════════════════════════════════════════════════════

export interface TimerPhotoMeta {
  id: string;
  takenAt: string;
  takenBy: string | null;
  size: number;
  readText: string | null;
  readKind: string | null;
  readProblem: string | null;
  used: boolean;
  runTimeUsed: string | null;
}

export const timerPhotoService = {
  async list(shiftId: string): Promise<TimerPhotoMeta[]> {
    return (await httpClient.get<{ photos: TimerPhotoMeta[] }>(`/ocr/timer/shift/${encodeURIComponent(shiftId)}/photos`)).photos;
  },
  file(photoId: string): Promise<Blob> {
    return httpClient.getBlob(`/ocr/timer/photo/${encodeURIComponent(photoId)}/file`);
  },
};

const PROBLEM_WORDS: Record<string, string> = {
  not_set_up: "Not read: reading photos isn't set up",
  not_read: "Not read: reading failed",
  blurry: "Too blurry to read",
  glare: "Glare on the display",
  cut_off: "Display cut off",
  too_dark: "Too dark to read",
  no_display: "No timer seen",
};

/** What the photo says, in a few words. */
export function photoSummary(p: TimerPhotoMeta): string {
  if (p.used && p.runTimeUsed) return `Run time ${p.runTimeUsed} filled from this photo`;
  if (p.readText) return `Read “${p.readText}”, not used`;
  return (p.readProblem && PROBLEM_WORDS[p.readProblem]) || "Not read";
}

function takenAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** An object URL for a kept photo, fetched with the session like any API read. */
function usePhotoUrl(photoId: string) {
  const { data: blob, isError } = useQuery({
    queryKey: ["timer-photo-file", photoId],
    queryFn: () => timerPhotoService.file(photoId),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return { url, isError };
}

function Thumb({ photo, selected, onSelect }: { photo: TimerPhotoMeta; selected: boolean; onSelect: () => void }) {
  const { url, isError } = usePhotoUrl(photo.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Timer photo, ${takenAt(photo.takenAt)}: ${photoSummary(photo)}`}
      className={cn(
        "relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-ink-100",
        selected ? "border-brand-500" : photo.used ? "border-status-success" : "border-ink-200"
      )}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-xs text-ink-400">{isError ? "Unavailable" : "…"}</span>
      )}
      {photo.used && (
        <span className="absolute inset-x-0 bottom-0 bg-status-success px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
          Used
        </span>
      )}
    </button>
  );
}

function Enlarged({ photo, onClose }: { photo: TimerPhotoMeta; onClose: () => void }) {
  const { url } = usePhotoUrl(photo.id);
  return (
    <figure className="space-y-1.5 rounded-lg border border-ink-200 bg-ink-50/60 p-2">
      <div className="flex items-start justify-between gap-2">
        <figcaption className="text-xs text-ink-600">
          <span className="font-medium text-ink-900">{photoSummary(photo)}</span>
          <br />
          Taken {takenAt(photo.takenAt)}
          {photo.takenBy ? ` by ${photo.takenBy}` : ""}
        </figcaption>
        <button type="button" onClick={onClose} aria-label="Close the photo" className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      {url && <img src={url} alt="The loom's timer, full size" className="max-h-[60vh] w-full rounded-md object-contain" />}
    </figure>
  );
}

export function TimerPhotos({ shiftId }: { shiftId: string }) {
  const { data: photos } = useQuery({
    queryKey: ["timer-photos", shiftId],
    queryFn: () => timerPhotoService.list(shiftId),
    retry: false,
  });
  // The photo the run time came from opens first: it is the one to check.
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (photos && openId === null) setOpenId(photos.find((p) => p.used)?.id ?? null);
  }, [photos, openId]);

  if (!photos || photos.length === 0) return null;
  const open = photos.find((p) => p.id === openId) ?? null;

  return (
    <section aria-label="Timer photos" className="space-y-2" data-testid="timer-photos">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-600">
        <Camera className="h-4 w-4" aria-hidden /> Timer photo{photos.length === 1 ? "" : `s (${photos.length})`}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} selected={p.id === openId} onSelect={() => setOpenId(p.id === openId ? "" : p.id)} />
        ))}
      </div>
      {open && <Enlarged photo={open} onClose={() => setOpenId("")} />}
    </section>
  );
}
