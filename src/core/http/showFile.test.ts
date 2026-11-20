import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { showFile } from "./showFile";

// ════════════════════════════════════════════════════════════
//  A PDF THAT WAS FETCHED, THEN SHOWN
//
//  A browser lets a page open a tab only as the direct answer to a
//  tap. A PDF is fetched first, and by the time it has arrived that
//  moment may be over — a phone's browser does not wait at all, a
//  desktop's gives a few seconds. The tab is refused, and the eight
//  screens that did this then did nothing: the button spun, stopped,
//  and no invoice, challan, purchase order or payslip appeared.
// ════════════════════════════════════════════════════════════

const pdf = () => new Blob(["%PDF-1.4"], { type: "application/pdf" });

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:made"), revokeObjectURL: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ""; });

describe("showFile", () => {
  it("opens the file in a new tab when the browser allows one", () => {
    const tab = { opener: {} as unknown };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    expect(showFile(pdf(), "INV-12.pdf")).toBe("opened");
    expect(open).toHaveBeenCalledWith("blob:made", "_blank");
    // The new tab is given no handle on this page.
    expect(tab.opener).toBeNull();
    expect(click).not.toHaveBeenCalled();
  });

  it("saves the file when the tab is refused, so the tap is never answered with nothing", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    let saved: { href: string; download: string } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved = { href: this.getAttribute("href") ?? "", download: this.download };
    });

    expect(showFile(pdf(), "BE/2026-27/0012.pdf")).toBe("saved");
    expect(saved).toEqual({ href: "blob:made", download: "BE-2026-27-0012.pdf" });
    // Nothing is left behind on the page.
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("lets go of the file a minute later", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "open").mockReturnValue({ opener: null } as unknown as Window);
    showFile(pdf(), "x.pdf");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:made");
    vi.useRealTimers();
  });
});
