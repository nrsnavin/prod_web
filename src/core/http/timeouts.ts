// ── How long a call waits ───────────────────────────────────────────────
//
// On its own page, apart from the client: a test that stands in for the
// client (most of them do) still needs these numbers to be the real ones.

/** The ordinary wait. A call that is neither of the two below answers well inside it. */
export const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * How long a call the server hands to the model may take: a draft, a
 * summary, an answer in the assistant. The server gives the model 30
 * seconds and tries twice; the ordinary 20 gave up — "Request timed
 * out — check your connection" — on an answer that then arrived with
 * nobody waiting for it.
 */
export const MODEL_TIMEOUT_MS = 75_000;

/**
 * How long a file upload may take. Most of them are read by the model
 * on the way in (a bill, a statement, a timer photo), and the server
 * gives one such read up to 90 seconds; the ordinary 20 would give up
 * on a read that was about to succeed.
 */
export const UPLOAD_TIMEOUT_MS = 120_000;
