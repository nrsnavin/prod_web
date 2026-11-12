import { useEffect, useRef, useState } from "react";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { ApiError, setLockOverrideAsker } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { formatDate } from "@/core/format/date";

type Ask = { id: number; error: ApiError; answer: (reason: string | null) => void };

/**
 * The books lock, when a write meets it.
 *
 * An entry or a cancellation dated inside a closed period is refused by
 * the server. An admin may let it through by saying why; the reason is
 * kept on the entry itself and in the lock history (Accounts → Settings).
 * This is the one place that asks: it is mounted once, and every write
 * the lock refuses — from any form — is offered it and sent again with
 * the reason. Anyone who is not an admin is shown the refusal as it is.
 */
export function LockOverrideHost() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // One at a time: a second refusal waits its turn behind the first.
  const [asks, setAsks] = useState<Ask[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    setLockOverrideAsker(isAdmin ? (error) => new Promise<string | null>((answer) => { nextId.current += 1; const id = nextId.current; setAsks((q) => [...q, { id, error, answer }]); }) : undefined);
    return () => setLockOverrideAsker(undefined);
  }, [isAdmin]);

  const ask = asks[0];
  if (!ask) return null;
  const lockDate = (ask.error.data?.details as { lockDate?: string } | undefined)?.lockDate;
  const done = (reason: string | null) => { ask.answer(reason); setAsks((q) => q.slice(1)); };
  return (
    // Keyed by the ask: the next refusal starts with an empty reason, not the one typed for the last.
    <ReasonDialog
      key={ask.id}
      open
      onClose={() => done(null)}
      onConfirm={(reason) => done(reason.trim())}
      title={lockDate ? `The books are closed up to ${formatDate(lockDate)}` : "The books are closed for this date"}
      description="This is dated inside the closed period, so it changes books that have gone to Tally. As an admin you can let it through: say why. The reason is kept on the entry and in the lock history."
      confirmLabel="Post it anyway"
      minLength={8}
    />
  );
}
