// ══════════════════════════════════════════════════════════════════
//  A SCREEN FROM LAST WEEK'S BUILD
//
//  Each screen is its own chunk, named by a content hash. A tab opened
//  before a deploy still holds the old names; when its user opens a
//  screen for the first time, the old chunk may no longer be on the
//  server and the import fails — which the error boundary shows as
//  "Something went wrong" with the browser's raw message.
//
//  A reload fixes it (the new index.html names the new chunks), so the
//  import failure triggers one. Once: if the reload does not help — the
//  network is down, say — the error surfaces normally instead of the
//  page reloading forever.
// ══════════════════════════════════════════════════════════════════

const KEY = "jarvis-chunk-reload-at";
/** A second failure within this long of the last reload is not stale code. */
export const RELOAD_WINDOW_MS = 30_000;

/** Chromium, Firefox and Safari word this differently. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch module/i.test(
    msg
  );
}

export interface ReloadDeps {
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  now(): number;
  reload(): void;
}

const browserDeps = (): ReloadDeps => {
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    /* blocked storage: never auto-reload, just surface the error */
  }
  return { storage, now: () => Date.now(), reload: () => window.location.reload() };
};

/**
 * For a lazy import's `.catch`. Reloads the page (and returns a promise
 * that never settles, so nothing renders in between) for a stale chunk;
 * rethrows anything else, or a repeat within the window.
 */
export function recoverFromStaleChunk<T>(err: unknown, deps: ReloadDeps = browserDeps()): Promise<T> {
  if (!isChunkLoadError(err) || !deps.storage) throw err;
  const last = Number(deps.storage.getItem(KEY) || 0);
  if (deps.now() - last < RELOAD_WINDOW_MS) throw err;
  deps.storage.setItem(KEY, String(deps.now()));
  deps.reload();
  return new Promise<T>(() => {});
}
