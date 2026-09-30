import { usePwaStore, type BeforeInstallPromptEvent } from "./pwaStore";

// ══════════════════════════════════════════════════════════════════
//  INSTALLING, UPDATING, AND KNOWING WHEN THE NETWORK IS GONE
//
//  The worker itself is pwa/sw.js. This is the page's side:
//
//  • Updates are ASKED for, never imposed. A new build installs in the
//    background and waits; the store's `updateReady` puts a "Reload"
//    banner on screen, and only that button lets it take over. The
//    tab that pressed it reloads. Other open tabs are NOT reloaded out
//    from under their users — they are told an update happened and
//    reload when their user is ready.
//
//  • Office PCs keep this app open for days, so the worker is asked to
//    check for a new build every 30 minutes and whenever the tab comes
//    back into view — otherwise a deploy would reach them next week.
//
//  • `online` follows the browser, so every screen can say "you're
//    offline" instead of a string of unexplained failed saves.
// ══════════════════════════════════════════════════════════════════

export const UPDATE_CHECK_MS = 30 * 60_000;

export interface PwaEnv {
  window: Window;
  navigator: Navigator;
  document: Document;
  reload(): void;
}

const browserEnv = (): PwaEnv => ({
  window,
  navigator,
  document,
  reload: () => window.location.reload(),
});

/** Online/offline and the install prompt. Safe in every build. */
export function watchConnectivityAndInstall(env: PwaEnv = browserEnv()): () => void {
  const { set } = usePwaStore.getState();
  const onOnline = () => set({ online: true });
  const onOffline = () => set({ online: false });
  const onPrompt = (e: Event) => {
    // Keep the browser's mini-infobar from appearing; the Install button
    // in the top bar offers the same thing at a moment the user chooses.
    e.preventDefault();
    set({ installEvent: e as BeforeInstallPromptEvent });
  };
  const onInstalled = () => set({ installEvent: null });

  env.window.addEventListener("online", onOnline);
  env.window.addEventListener("offline", onOffline);
  env.window.addEventListener("beforeinstallprompt", onPrompt);
  env.window.addEventListener("appinstalled", onInstalled);
  set({ online: env.navigator.onLine !== false });

  return () => {
    env.window.removeEventListener("online", onOnline);
    env.window.removeEventListener("offline", onOffline);
    env.window.removeEventListener("beforeinstallprompt", onPrompt);
    env.window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Register /sw.js and wire the update flow into the store. */
export async function registerServiceWorker(env: PwaEnv = browserEnv()): Promise<void> {
  const sw = env.navigator.serviceWorker;
  if (!sw) return;

  const reg = await sw.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const { set } = usePwaStore.getState();

  // Whether the page was already controlled when it loaded. The very
  // first install also fires controllerchange (clients.claim), and that
  // is not an update — nothing was replaced.
  const hadController = !!sw.controller;
  let reloadingForUpdate = false;

  const offer = (worker: ServiceWorker) =>
    set({
      updateReady: true,
      applyUpdate: () => {
        reloadingForUpdate = true;
        worker.postMessage({ type: "SKIP_WAITING" });
      },
    });

  // A build that finished installing while no tab was looking.
  if (reg.waiting && sw.controller) offer(reg.waiting);

  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // "installed" with a controller present = an update, now waiting.
      // Without one it is the first install, and it activates by itself.
      if (installing.state === "installed" && sw.controller) offer(installing);
    });
  });

  sw.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return env.reload();
    if (hadController) set({ updateReady: false, applyUpdate: null, updatedElsewhere: true });
  });

  const check = () => reg.update().catch(() => undefined); // offline: try later
  env.window.setInterval(check, UPDATE_CHECK_MS);
  env.document.addEventListener("visibilitychange", () => {
    if (env.document.visibilityState === "visible") check();
  });
}

/** Called once from main.tsx. */
export function startPwa(): void {
  watchConnectivityAndInstall();
  // Never in dev: a worker caching Vite's dev modules breaks hot reload,
  // and dev has no sw.js to register anyway.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      registerServiceWorker().catch((err) => console.warn("Service worker not registered:", err));
    });
  }
}
