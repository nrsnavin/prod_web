import { useEffect, useRef, useState } from "react";
import { CameraOff, ScanLine } from "lucide-react";

// ══════════════════════════════════════════════════════════════════
//  THE CAMERA, POINTED AT A LOOM'S LABEL
//
//  Two readers, the same loop:
//
//    • the browser's own (BarcodeDetector — Chrome on Android and on a
//      Mac), fast and free, used where it exists;
//    • jsQR, bundled, for everything else — Safari on an iPhone or
//      iPad, Firefox, Chrome on Windows. Loaded only when needed, so
//      the page costs nothing extra where the browser can read.
//
//  What still stops a scan is the camera itself: a page on plain
//  http:// (browsers switch the camera off there), or permission
//  refused. The screen says which, and the loom is picked from the
//  list or typed instead — the scanner is the fast way, never the
//  only way.
//
//  The same code read twice in a row within a few seconds is one scan:
//  the camera keeps seeing the label after the first read.
// ══════════════════════════════════════════════════════════════════

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/** The browser's reader, if it has one. */
export function barcodeDetector(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return typeof w.BarcodeDetector === "function" ? w.BarcodeDetector : null;
}

/** A function that reads one video frame and gives the code on it, or null. */
type FrameReader = (video: HTMLVideoElement) => Promise<string | null>;

async function nativeReader(): Promise<FrameReader | null> {
  const Detector = barcodeDetector();
  if (!Detector) return null;
  const detector = new Detector({ formats: ["qr_code"] });
  return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
}

/** jsQR over a canvas copy of the frame, shrunk so a phone keeps up. */
export async function bundledReader(maxSide = 640): Promise<FrameReader | null> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  return async (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const scale = Math.min(1, maxSide / Math.max(vw, vh));
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
    return found?.data || null;
  };
}

type Phase = "starting" | "scanning" | "no-camera" | "insecure" | "denied" | "failed";

const REPEAT_MS = 3000;

export function QrScanner({ onCode, paused = false }: { onCode: (code: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const last = useRef<{ code: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      // No camera API at all: an insecure address is the usual reason.
      setPhase(typeof window.isSecureContext === "boolean" && !window.isSecureContext ? "insecure" : "no-camera");
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let busy = false;

    (async () => {
      const read = (await nativeReader()) ?? (await bundledReader().catch(() => null));
      if (!read) { setPhase("failed"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        setPhase(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "failed");
        return;
      }
      if (stopped || !video.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.current.srcObject = stream;
      try { await video.current.play(); } catch { /* autoplay refused: the frame still shows */ }
      setPhase("scanning");
      timer = setInterval(async () => {
        if (stopped || busy || pausedRef.current || !video.current || video.current.readyState < 2) return;
        busy = true;
        try {
          const code = await read(video.current);
          if (!code) return;
          const now = Date.now();
          if (last.current && last.current.code === code && now - last.current.at < REPEAT_MS) return;
          last.current = { code, at: now };
          onCodeRef.current(code);
        } catch {
          /* a frame it could not read; the next one is along in a moment */
        } finally {
          busy = false;
        }
      }, 250);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (phase !== "starting" && phase !== "scanning") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-ink-200 bg-surface-muted p-3 text-sm text-ink-600" data-testid="scanner-off">
        <CameraOff className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" aria-hidden />
        <p>
          {phase === "insecure" && "The camera only works when the page is opened over https://. Open the secure address to scan, or pick the loom from the list below."}
          {phase === "no-camera" && "This browser has no camera access. Pick the loom from the list below, or type its ID."}
          {phase === "denied" && "Camera access was refused. Allow it in the browser's site settings to scan, or pick the loom from the list below."}
          {phase === "failed" && "The camera could not be started. Pick the loom from the list below, or type its ID."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "4 / 3" }} data-testid="scanner">
      <video ref={video} muted playsInline className="h-full w-full object-cover" aria-label="Camera, pointed at the loom's label" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-center text-xs font-medium text-white">
        <ScanLine className="h-4 w-4" aria-hidden />
        {phase === "starting" ? "Starting the camera…" : paused ? "Paused" : "Point at the label on the loom"}
      </p>
    </div>
  );
}
