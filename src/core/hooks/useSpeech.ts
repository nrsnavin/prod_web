import { useCallback, useEffect, useRef, useState } from "react";

// ══════════════════════════════════════════════════════════════════
//  SPEECH TO TEXT, IN THE BROWSER
//
//  The browser's own speech recognition (Chrome and Edge on Android and
//  desktop; Safari on iOS): nothing is recorded or uploaded by this app,
//  only the words come back. Tamil is "ta-IN", English "en-IN". Where the
//  browser has none, `supported` is false and the screen offers typing.
// ══════════════════════════════════════════════════════════════════

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechLang = "ta-IN" | "en-IN";

/**
 * @param onText called with each finished phrase, to append to what is typed
 */
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const supported = !!ctor();

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback((lang: SpeechLang) => {
    const C = ctor();
    if (!C) { setError("This browser cannot take speech — type it instead."); return; }
    setError(null);
    const r = new C();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal && res[0]?.transcript) cb.current(res[0].transcript.trim());
      }
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Allow the microphone for this site to speak." : e.error === "no-speech" ? "Nothing was heard — try again, closer to the phone." : "Speech stopped — type it instead.");
    r.onend = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, error, start, stop };
}
