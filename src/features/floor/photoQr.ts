import { barcodeDetector } from "./QrScanner";

// ══════════════════════════════════════════════════════════════════
//  THE LOOM'S LABEL, FOUND IN A PHOTO OF ITS PANEL
//
//  One photo for both: the label with its QR code and the timer beside
//  it. The label is read here, on the phone — the browser's own reader
//  where there is one, else jsQR — and the same photo then goes to the
//  server to read the run time. A label is small in a photo of the whole
//  panel, so jsQR looks at the photo larger than the live scanner does,
//  and once more smaller when that finds nothing.
// ══════════════════════════════════════════════════════════════════

export async function qrFromPhoto(photo: Blob): Promise<string | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(photo);
    const Detector = barcodeDetector();
    if (Detector) {
      try {
        const found = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
        if (found[0]?.rawValue) return found[0].rawValue;
      } catch {
        /* this browser's reader cannot take a still: jsQR below */
      }
    }
    const { default: jsQR } = await import("jsqr");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    for (const maxSide of [1600, 900]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
      if (found?.data) return found.data;
    }
    return null;
  } catch {
    return null;
  } finally {
    bitmap?.close?.();
  }
}
