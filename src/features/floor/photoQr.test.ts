import { afterEach, describe, expect, it, vi } from "vitest";
import { qrFromPhoto } from "./photoQr";

// The loom's label, read off a still photo on the phone.

const photo = new Blob([new Uint8Array([1])], { type: "image/jpeg" });

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
});

describe("the label in a photo", () => {
  it("is read by the browser's own reader when there is one", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 4000, height: 3000, close })));
    const detect = vi.fn(async () => [{ rawValue: "MACHINE|abc|L1" }]);
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class { detect = detect; };
    expect(await qrFromPhoto(photo)).toBe("MACHINE|abc|L1");
    expect(close).toHaveBeenCalled();
  });

  it("is nothing when the photo cannot be opened here", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    expect(await qrFromPhoto(photo)).toBeNull();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("not an image"); }));
    expect(await qrFromPhoto(photo)).toBeNull();
  });
});
