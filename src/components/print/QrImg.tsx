import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Small QR for labels — encodes a traceability payload (job/beam/box ids)
// so labels can be scanned back into the system later.
//
// ── `margin` is the quiet zone, in modules ────────────────────────
// The QR spec asks for 4 clear modules round the code; readers use it
// to find the symbol's edges, and without it many simply refuse. This
// has always been 0 here, leaving the quiet zone to whatever padding
// the surrounding CSS happened to give — which works until somebody
// tightens a label, and fails as "the scanner won't read it" rather
// than as anything anyone would trace back to a stylesheet.
//
// It stays 0 by default so no existing label moves, and the surfaces
// that are tight enough for it to matter ask for the real 4.
export function QrImg({
  value, size = 64, margin = 0,
}: { value: string; size?: number; margin?: number }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { margin, width: size * 2 })
      .then(setUrl)
      .catch(() => setUrl(""));
  }, [value, size, margin]);
  if (!url) return null;
  return <img src={url} width={size} height={size} alt={`QR: ${value}`} />;
}
