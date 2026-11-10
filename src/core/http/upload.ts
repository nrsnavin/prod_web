import { ApiError, httpClient } from "./httpClient";

// ══════════════════════════════════════════════════════════════════
//  SENDING A FILE
//
//  Nineteen screens sent their photo or file with a bare
//  `fetch("/api/v2/…")`. That address is relative to the page: it reaches
//  the API only where the page and the API share a host — the dev
//  server, which forwards /api. A built app is served from one host and
//  talks to the API on another (config.apiBaseUrl), so in production
//  every one of those uploads went to the WEB host: reading a bill, a
//  bank statement, a GSTR-2B file, a receipt, a complaint photo. It also
//  skipped what the shared client does for every other request — the
//  sign-in redirect when the session has ended, the server's error code.
//
//  uploadForm sends the form through the shared client, to the same
//  place as everything else, and waits long enough for a photo to be
//  read.
// ══════════════════════════════════════════════════════════════════

/**
 * POST a form with files to an API path ("/accounts/scan").
 *
 * @param fallback what to say when the server refused without a reason
 *                 of its own ("Could not read the bill"). A timeout or a
 *                 dropped connection keeps its own message.
 */
export async function uploadForm<T>(path: string, form: FormData, fallback = "Upload failed"): Promise<T> {
  try {
    return await httpClient.upload<T>(path, form);
  } catch (e) {
    if (e instanceof ApiError) {
      const said = typeof e.data?.message === "string" && e.data.message.trim() !== "";
      // The server's own words, or the network's; otherwise what was being done.
      if (said || e.status === undefined) throw e;
      throw new ApiError(fallback, e.status, e.cause, e.code, e.data);
    }
    throw e instanceof Error ? e : new Error(fallback);
  }
}
