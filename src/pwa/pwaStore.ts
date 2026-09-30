import { create } from "zustand";

/**
 * Chrome's install prompt event. Not in lib.dom — it is Chromium-only,
 * which is also why the Install button simply never appears on Safari
 * (there, installing is Share → Add to Home Screen).
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaState {
  /** A new build is installed and waiting for the user to accept it. */
  updateReady: boolean;
  /** Called to let the waiting build take over; set by the registration. */
  applyUpdate: (() => void) | null;
  /** Another tab accepted an update; this one is still on the old code. */
  updatedElsewhere: boolean;

  /** The deferred install prompt, while the browser is offering one. */
  installEvent: BeforeInstallPromptEvent | null;

  online: boolean;

  set(patch: Partial<Omit<PwaState, "set">>): void;
}

export const usePwaStore = create<PwaState>()((set) => ({
  updateReady: false,
  applyUpdate: null,
  updatedElsewhere: false,
  installEvent: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
  set: (patch) => set(patch),
}));

/** True when the app is running as an installed, standalone window. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true || // iOS home-screen app
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}
