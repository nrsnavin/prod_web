import { describe, it, expect, vi, beforeEach } from "vitest";
import { qcService, exportedMessage } from "./api";

// ══════════════════════════════════════════════════════════════════
//  THE LABELLED-PHOTO EXPORT
//
//  Every sample carries its photo. The page fetched the whole set as
//  JSON, parsed it, and wrote it out again indented to make the file —
//  three copies of every photo in the browser at once — and asked for no
//  number, so anything past the newest 500 was left out without a word.
//
//  It is saved as it arrives now, and asks for all the server will give.
// ══════════════════════════════════════════════════════════════════

const getBlob = vi.fn();
const get = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a), getBlob: (...a: unknown[]) => getBlob(...a) } };
});

beforeEach(() => { getBlob.mockReset(); get.mockReset(); });

describe("exporting the labelled photos", () => {
  it("takes the file as it is, and all the server will give", async () => {
    const file = new Blob(['{"success":true,"samples":[],"count":0}'], { type: "application/json" });
    getBlob.mockResolvedValue(file);

    expect(await qcService.exportDataset()).toBe(file);
    // Before: httpClient.get — parsed here, and no limit asked for (500).
    expect(getBlob).toHaveBeenCalledWith("/qc/export-dataset", { limit: 2000 });
    expect(get).not.toHaveBeenCalled();
  });

  it("says how many went, and when that was not all of them", () => {
    expect(exportedMessage(1)).toBe("Exported 1 labelled sample");
    expect(exportedMessage(340)).toBe("Exported 340 labelled samples");
    expect(exportedMessage(2600)).toBe("Exported the newest 2,000 of 2,600 labelled samples");
  });
});
