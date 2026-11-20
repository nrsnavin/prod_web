// ════════════════════════════════════════════════════════════
//  SHOWING A FILE THE SERVER JUST MADE
//
//  A PDF is fetched through the shared client (so the session and the
//  server's own error words apply), then shown in a new tab.
//
//  A browser lets a page open a tab only as the direct answer to a tap.
//  By the time the file has arrived that moment may be over: a phone's
//  browser does not wait at all, a desktop's gives a few seconds — less
//  than a long invoice takes on a slow line. The tab is refused. Eight
//  screens opened theirs this way, each with its own copy, and when the
//  tab was refused they did nothing: the button spun, stopped, and no
//  invoice, challan, purchase order or payslip appeared.
//
//  So: a new tab where the browser allows one, and where it does not the
//  file is saved instead — a download needs no such permission. The
//  answer says which happened, for a screen that wants to mention it.
// ════════════════════════════════════════════════════════════

/** A name a file can be saved under: an invoice number has slashes in it. */
const fileName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "document";

/**
 * @param name what to call the file if it has to be saved ("INV-12.pdf")
 */
export function showFile(blob: Blob, name: string): "opened" | "saved" {
  const url = URL.createObjectURL(blob);
  // No "noopener" in the features: with it the browser answers null
  // whether or not the tab opened, and a refusal could not be told from
  // a success. The handle is dropped by hand instead.
  const tab = window.open(url, "_blank");
  if (tab) {
    try { tab.opener = null; } catch { /* the tab is already on its own */ }
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // The tab (or the download) keeps its own hold on the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return tab ? "opened" : "saved";
}
