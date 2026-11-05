import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/components/ui/ErrorState";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";
import { Answers, MeterReadings, MetreCounter, Step, TYPE_IT, TimerReading, metreCounter, nextStep } from "./timerReading";

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

/**
 * Where the photo goes. The signed-in screens use the OCR route below;
 * the floor-entry screen, opened with a shift PIN, passes its own
 * (features/floor/floorClient.ts), which keeps the photo with the entry
 * the same way.
 */
export interface TimerOcrService {
  read(photo: Blob, shiftId?: string): Promise<OcrResponse>;
  /** `meter`: the total-hours readings the run time came from, kept for the next shift to start from. */
  used(photoId: string, runTime: string, meter?: { start: number; end: number }, counter?: number): Promise<unknown>;
  settle?(id: string, runTime: string): Promise<unknown>;
}

export const timerOcrService: TimerOcrService = {
  read(photo: Blob, shiftId?: string): Promise<OcrResponse> {
    const form = new FormData();
    if (shiftId) form.append("shiftId", shiftId); // before the file, so it is read first
    form.append("photo", photo, "timer.jpg");
    return httpClient.post<OcrResponse>("/ocr/timer", form);
  },
  /** The kept photo the run time was filled from; settles its reading too. Best effort. */
  used(photoId: string, runTime: string, meter?: { start: number; end: number }, counter?: number) {
    return httpClient.post(`/ocr/timer/photo/${encodeURIComponent(photoId)}/use`, { runTime, ...(meter ? { meter } : {}), ...(counter != null ? { counter } : {}) }).catch(() => undefined);
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
  service = timerOcrService,
  prompt,
  startHours = null,
  initialPhoto,
  onMetres,
  previousMetres = null,
}: {
  onUse: (runTime: string) => void;
  shiftHours?: number;
  /** Keeps the photo with this shift for verification. */
  shiftId?: string;
  /** Where the photo is sent; the signed-in OCR route unless told otherwise. */
  service?: TimerOcrService;
  /**
   * Given, the photo is asked for rather than offered: a full-width
   * button with these words (the floor, where every entry should come
   * with a photo of the display) instead of the small link.
   */
  prompt?: string;
  /**
   * Where a total-hours meter stood when the shift before ended on this
   * loom (from its photo): the start of this shift, so nobody has to
   * remember it. Ignored for a run-time display, which starts from zero.
   */
  startHours?: number | null;
  /**
   * A photo already taken (the floor's one photo of the label and the
   * timer): read as if just taken here. Given with `shiftId` unknown yet,
   * it waits until there is one, so the photo is kept with the entry.
   */
  initialPhoto?: File;
  /**
   * Given, a metre counter seen in the photo (unit MTR or M) is offered
   * to fill the metres — as it reads, or less where it stood when the
   * shift before ended (`previousMetres`) for a counter that runs on.
   */
  onMetres?: (metres: number) => void;
  previousMetres?: number | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  // A metre counter in the photo, offered until it is used or another photo is taken.
  const [counter, setCounter] = useState<MetreCounter | null>(null);
  const [counterUsed, setCounterUsed] = useState<number | null>(null);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  // The photo taken before this screen, read once — when the entry it
  // belongs to exists, if the screen keeps photos with one.
  const tookInitial = useRef(false);
  const waiting = !!initialPhoto && !tookInitial.current && !shiftId;
  useEffect(() => {
    if (!initialPhoto || tookInitial.current || !shiftId) return;
    tookInitial.current = true;
    void onFile(initialPhoto);
    // onFile is recreated each render; the photo and the entry are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhoto, shiftId]);

  const pick = () => input.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setState({ phase: "reading" });
    setTyped("");
    setCounter(null);
    setCounterUsed(null);
    try {
      const { reading, suggestionId, photoId = null } = await service.read(await shrinkPhoto(file), shiftId);
      setState({ phase: "steps", reading, suggestionId, photoId, answers: {} });
      setCounter(metreCounter(reading));
    } catch (e) {
      setState({ phase: "failed", message: errorMessage(e, "the photo"), kept: !!keptPhotoId(e) });
    }
  };

  const step: Step | null = state.phase === "steps" ? nextStep(state.reading, state.answers, { shiftHours, startHours }) : null;

  const answer = (id: string, value: string) => {
    if (state.phase !== "steps") return;
    setState({ ...state, answers: { ...state.answers, [id]: value } });
    setTyped("");
  };

  const use = (runTime: string, meter?: MeterReadings) => {
    const readings = meter ? { start: meter.start, end: meter.end } : undefined;
    // What the counter read goes with the photo too: the next shift's start.
    if (state.phase === "steps" && state.photoId) void service.used(state.photoId, runTime, readings, counter?.value);
    else if (state.phase === "steps" && state.suggestionId && service.settle) void service.settle(state.suggestionId, runTime);
    onUse(runTime);
    setState({ phase: "used", runTime, kept: state.phase === "steps" && !!state.photoId });
  };

  const sinceBefore = counter && previousMetres != null && counter.value > previousMetres ? Math.round((counter.value - previousMetres) * 100) / 100 : null;
  const fillMetres = (m: number) => { onMetres?.(m); setCounterUsed(m); };
  const counterOffer = onMetres && counter && (
    <div className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm" aria-label="Metre counter">
      <p className="text-ink-600">
        The photo also shows a metre counter: <span className="font-semibold tabular-nums text-ink-900">{counter.text}</span> {counter.label}
      </p>
      {counterUsed != null ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-status-success"><Check className="h-3.5 w-3.5" aria-hidden /> Metres a head filled: {counterUsed}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {sinceBefore != null && (
            <Button type="button" size="sm" variant="secondary" onClick={() => fillMetres(sinceBefore)}>
              Use {sinceBefore} m — since the shift before ({previousMetres} at its end)
            </Button>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => fillMetres(counter.value)}>
            Use {counter.value} m as the metres a head
          </Button>
        </div>
      )}
    </div>
  );

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
      <div className="space-y-1.5">
        {fileInput}
        {waiting && (
          <p className="text-sm text-ink-600" role="status">
            The photo of the label and the timer is taken — it is read for the run time once the loom is on the shift.
          </p>
        )}
        {prompt ? (
          <Button type="button" size="lg" className="w-full" onClick={pick}>
            <Camera className="h-5 w-5" aria-hidden /> {prompt}
          </Button>
        ) : (
          <button type="button" onClick={pick} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            <Camera className="h-4 w-4" aria-hidden /> Read the timer from a photo
          </button>
        )}
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
        {counterOffer && <div className="w-full">{counterOffer}</div>}
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
        {state.phase === "steps" && counterOffer}

        {step?.kind === "type" && <p className="text-ink-700">{step.reason}</p>}

        {step?.kind === "done" && (
          <>
            <p className="text-ink-600">
              Run time <span className="text-lg font-semibold tabular-nums text-ink-900">{step.runTime}</span>
              {step.text !== step.runTime && <span className="ml-1 text-xs text-ink-400">from “{step.text}”</span>}
            </p>
            {step.meter?.fromPrevious && (
              <p className="text-xs text-ink-500">
                Meter {step.meter.start} h at the start — where it stood when the shift before ended (its photo), to {step.meter.end} h now.{" "}
                <button type="button" onClick={() => answer("prevStart", "no")} className="font-medium text-brand-600">
                  Different start reading
                </button>
              </p>
            )}
            <Button type="button" size="sm" onClick={() => use(step.runTime, step.meter)}>
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
