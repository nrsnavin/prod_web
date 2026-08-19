import { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "./Button";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  A SERVER OUTAGE MUST NOT LOOK LIKE AN EMPTY SCREEN
//
//  Eighteen pages rendered a query result without ever checking whether
//  the query had failed. The data came back undefined, the empty state
//  drew itself, and the interface made a confident factual claim that
//  happened to be false:
//
//      SERVER IS DOWN. The screen says:
//        "No complaints — nothing has been filed under this filter."
//
//  That is not a missing spinner. It is the software telling a quality
//  manager that no customer has complained, during an outage, in a calm
//  grey box. Somebody then acts on it.
//
//  The same disease the backend audit found — a failure path producing
//  silence indistinguishable from a normal result — one layer up, and
//  worse here because here a person reads it.
//
//  So a list has THREE branches and never two: loading, failed, empty.
//  This is the middle one. It says what failed, in the server's words
//  where there are any, and offers the retry, because "something went
//  wrong" with no way forward is only marginally better than a lie.
// ══════════════════════════════════════════════════════════════════

export interface ErrorStateProps {
  /** The thrown value from the query. Anything unrecognised still renders. */
  error?: unknown;
  /** What could not be loaded, e.g. "complaints". Used in the sentence. */
  what?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

/**
 * The server's own sentence when it gave one, and never a bare
 * "Error: Network Error" — an axios message is not something a person
 * on a shop floor can act on.
 */
export function errorMessage(error: unknown, what = "this"): string {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && /network|fetch|timeout/i.test(error.message)) {
    return `Could not reach the server, so ${what} could not be loaded. Check the connection and try again.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return `Something went wrong loading ${what}.`;
}

export function ErrorState({ error, what = "this", onRetry, action }: ErrorStateProps) {
  const status = error instanceof ApiError ? error.status : undefined;

  return (
    <div
      // Announced, not merely drawn. This replaces content the reader
      // was expecting, so it has to interrupt rather than wait.
      role="alert"
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 text-status-danger">
        <AlertTriangle className="h-12 w-12" />
      </div>
      <h3 className="text-base font-semibold text-ink-900">
        Could not load {what}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{errorMessage(error, what)}</p>

      {/* Deliberately shown: it is the one detail that tells somebody
          whether to retry, refresh their session, or call for help. */}
      {status !== undefined && (
        <p className="mt-1 text-xs text-ink-400">Server responded {status}</p>
      )}

      <div className="mt-4 flex gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <RotateCw className="h-4 w-4" /> Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
