import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Small QR for labels — encodes a traceability payload (job/beam/box ids)
// so labels can be scanned back into the system later.
export function QrImg({ value, size = 64 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 0, width: size * 2 })
      .then(setUrl)
      .catch(() => setUrl(""));
  }, [value, size]);
  if (!url) return null;
  return <img src={url} width={size} height={size} alt={`QR: ${value}`} />;
}
