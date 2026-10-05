import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/components/ui/ErrorState";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";
import { Answers, Step, TYPE_IT, TimerReading, nextStep } from "./timerReading";

// ══════════════════════════════════════════════════════════════════
//  "READ THE TIMER FROM A PHOTO"
//
//  Optional, under the Run time field of a production entry. The person
//  photographs the loom's display; the server reads every number on it
//  (api/timerOcr.js); timerReading.ts works out the run time and asks
//  about anything it isn't sure of, one question at a time, with the
//  photo beside the question so it can be checked. Nothing fills the
//  field until the person presses "Use this", and the field stays
//  editable after. The photo is shrunk on the phone before it is sent.
//  Given the shift, the server keeps the photo with it (read or not), so
//  whoever verifies the entry can see the display (TimerPhotos.tsx).
// ══════════════════════════════════════════════════════════════════

interface OcrResponse {
  reading: TimerReading;
  suggestionId: string | null;
  /** Set when the photo was kept with the shift. */
  photoId?: string | null;
}

export const timerOcrService = {
  read(photo: Blob, shiftId?: string): Promise<OcrResponse> {
    const form = new FormData();
    if (shiftId) form.append("shiftId", shiftId); // before the file, so it is read first
    form.append("photo", photo, "timer.jpg");
    return httpClient.post<OcrResponse>("/ocr/timer", form);
  },
  /** The kept photo the run time was filled from; settles its reading too. Best effort. */
  used(photoId: string, runTime: string) {
    return httpClient.post(`/ocr/timer/photo/${encodeURIComponent(photoId)}/use`, { runTime }).catch(() => undefined);
  },
  /** What was actually used, for the AI accuracy report. Best effort. */
  settle(id: string, runTime: string) {
    return httpClient.post(`/ocr/timer/${encodeURIComponent(id)}/settle`, { runTime }).catch(() => undefined);
  },
};

/**
 * A phone photo is 3–5 MB; the display needs far less. Shrinks to at most
 * 1600 px as JPEG. Anything that can't be decoded here is sent as it is,
 * and the server says if it can't read it.
 */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

type State =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "steps"; reading: TimerReading; suggestionId: string | null; photoId: string | null; answers: Answers }
  | { phase: "failed"; message: string; kept: boolean }
  | { phase: "used"; runTime: string; kept: boolean };

/** The id of a photo the server kept even though it couldn't read it. */
function keptPhotoId(e: unknown): string | null {
  const details = e instanceof ApiError ? (e.data?.details as { photoId?: unknown } | undefined) : undefined;
  return typeof details?.photoId === "string" ? details.photoId : null;
}

const KEPT = "The photo is saved with this shift for whoever verifies it.";

export function TimerPhotoReader({
  onUse,
  shiftHours = 12,
  shiftId,
}: {
  onUse: (runTime: string) => void;
  shiftHours?: number;
  /** Keeps the photo with this shift for verification. */
  shiftId?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const pick = () => input.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setState({ phase: "reading" });
    setTyped("");
    try {
      const { reading, suggestionId, photoId = null } = await timerOcrService.read(await shrinkPhoto(file), shiftId);
      setState({ phase: "steps", reading, suggestionId, photoId, answers: {} });
    } catch (e) {
      setState({ phase: "failed", message: errorMessage(e, "the photo"), kept: !!keptPhotoId(e) });
    }
  };

  const step: Step | null = state.phase === "steps" ? nextStep(state.reading, state.answers, { shiftHours }) : null;

  const answer = (id: string, value: string) => {
    if (state.phase !== "steps") return;
    setState({ ...state, answers: { ...state.answers, [id]: value } });
    setTyped("");
  };

  const use = (runTime: string) => {
    if (state.phase === "steps" && state.photoId) void timerOcrService.used(state.photoId, runTime);
    else if (state.phase === "steps" && state.suggestionId) void timerOcrService.settle(state.suggestionId, runTime);
    onUse(runTime);
    setState({ phase: "used", runTime, kept: state.phase === "steps" && !!state.photoId });
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      aria-label="Photo of the loom's timer"
      accept="image/*"
      capture="environment"
      className="hidden"
      data-testid="timer-photo-input"
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = ""; // the same photo can be chosen again
      }}
    />
  );

  if (state.phase === "idle") {
    return (
      <div>
        {fileInput}
        <button type="button" onClick={pick} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <Camera className="h-4 w-4" aria-hidden /> Read the timer from a photo
        </button>
      </div>
    );
  }

  if (state.phase === "used") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-500">
        {fileInput}
        <Check className="h-4 w-4 text-status-success" aria-hidden />
        Filled from the photo: <span className="font-medium tabular-nums text-ink-900">{state.runTime}</span>
        {state.kept && <span className="text-xs text-ink-400">(photo saved with the shift)</span>}
        <button type="button" onClick={pick} className="font-medium text-brand-600">Retake</button>
      </div>
    );
  }

  return (
    <div className="flex gap-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3" aria-live="polite">
      {fileInput}
      {photoUrl && (
        <img src={photoUrl} alt="The timer photo" className="h-24 w-24 shrink-0 rounded-md border border-ink-200 object-cover" />
      )}
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        {state.phase === "reading" && (
          <p className="flex items-center gap-2 text-ink-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading the timer…
          </p>
        )}

        {state.phase === "failed" && (
          <>
            <p role="alert" className="text-status-danger">{state.message}</p>
            {state.kept && <p className="text-xs text-ink-500">{KEPT}</p>}
          </>
        )}
        {state.phase === "steps" && state.photoId && step?.kind === "type" && <p className="text-xs text-ink-500">{KEPT}</p>}

        {step?.kind === "type" && <p className="text-ink-700">{step.reason}</p>}

        {step?.kind === "done" && (
          <>
            <p className="text-ink-600">
              Run time <span className="text-lg font-semibold tabular-nums text-ink-900">{step.runTime}</span>
              {step.text !== step.runTime && <span className="ml-1 text-xs text-ink-400">from “{step.text}”</span>}
            </p>
            <Button type="button" size="sm" onClick={() => use(step.runTime)}>
              <Check className="h-4 w-4" aria-hidden /> Use this
            </Button>
          </>
        )}

        {step?.kind === "question" && (
          <>
            <p className="font-medium text-ink-900">{step.question.text}</p>
            {"options" in step.question ? (
              <div className="flex flex-col gap-1.5">
                {step.question.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => answer(step.question.id, o.value)}
                    className={cn(
                      "min-h-10 rounded-lg border px-3 py-2 text-left text-sm font-medium",
                      o.value === TYPE_IT
                        ? "border-transparent text-ink-500 hover:text-ink-900"
                        : "border-ink-200 bg-surface text-ink-900 hover:border-brand-500"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              // Not a <form>: this sits inside the production entry form,
              // and a nested form is dropped by the browser, so its button
              // would submit the whole entry instead of answering.
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="sr-only">Meter reading at the start of the shift</span>
                  <input
                    inputMode="decimal"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value.replace(",", "."))}
                    placeholder="e.g. 1226.9"
                    className="h-10 w-full rounded-lg border border-ink-200 bg-surface px-3 text-sm tabular-nums"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault(); // answers the question, never submits the entry
                      if (typed.trim()) answer("start", typed);
                    }}
                  />
                </label>
                <Button type="button" size="sm" disabled={!typed.trim()} onClick={() => answer("start", typed)}>
                  Next
                </Button>
              </div>
            )}
            {step.error && <p role="alert" className="text-status-danger">{step.error}</p>}
          </>
        )}

        {state.phase !== "reading" && (
          <button type="button" onClick={pick} className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Take another photo
          </button>
        )}
      </div>
    </div>
  );
}
