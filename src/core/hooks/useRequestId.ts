import { useMemo, useRef } from "react";

// ══════════════════════════════════════════════════════════════════
//  ONE ID PER BUSINESS EVENT, SO A RESEND IS NOT A SECOND EVENT
//
//  Submits that move stock (packing, a delivery challan, wastage, goods
//  received) carry a `requestId`. The server records each id once and
//  answers a repeat with what it already did, so a double tap, or a
//  resend after a timeout whose first attempt actually landed, does not
//  pack, ship or receive the same goods twice.
//
//  The id is kept while the same form is resent unchanged, renewed when
//  what is being sent changes (that is a different submission), and
//  renewed after a success (the next one is a new event). The same rule
//  as the admin app's packing and challan screens.
// ══════════════════════════════════════════════════════════════════

export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export interface RequestIds {
  /** The id for sending `body`: the same as last time if `body` is unchanged. */
  for(body: unknown): string;
  /** The last send succeeded: the next one is a new event. */
  done(): void;
}

export function useRequestId(): RequestIds {
  const last = useRef<{ id: string; sig: string } | null>(null);
  return useMemo(
    () => ({
      for(body: unknown) {
        const sig = JSON.stringify(body ?? null);
        if (!last.current || last.current.sig !== sig) last.current = { id: newRequestId(), sig };
        return last.current.id;
      },
      done() {
        last.current = null;
      },
    }),
    []
  );
}
