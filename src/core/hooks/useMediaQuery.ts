import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept live as the window changes.
 *
 * False wherever matchMedia does not exist (jsdom, very old browsers),
 * so anything gated on it falls back to the desktop layout rather than
 * guessing.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false
  );
}

/** Below Tailwind's `sm` breakpoint — a phone held upright. */
export const PHONE_QUERY = "(max-width: 639px)";

export const useIsPhone = () => useMediaQuery(PHONE_QUERY);
