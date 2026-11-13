import { useEffect, useState } from "react";
import { priceListService } from "./api";
import type { RateFlag } from "./types";

/**
 * Purchase order lines above what the supplier quoted, asked of the
 * server a moment after the lines stop changing. A flag is a warning:
 * the PO is never refused for it. A check that fails (no access, the
 * server unreachable) shows nothing rather than an error.
 */
export function useRateFlags(supplier: string | undefined, lines: Array<{ rawMaterial: string; rate: number; description?: string }>): RateFlag[] {
  const [flags, setFlags] = useState<RateFlag[]>([]);
  // What the answer depends on: the supplier, and each line's material and rate.
  const key = JSON.stringify([supplier ?? "", lines.map((l) => [l.rawMaterial, l.rate])]);
  useEffect(() => {
    const priced = lines.some((l) => l.rawMaterial && l.rate > 0);
    if (!supplier || !priced) { setFlags([]); return; }
    let live = true;
    const t = setTimeout(() => {
      priceListService.check(supplier, lines).then((f) => { if (live) setFlags(f); }).catch(() => { if (live) setFlags([]); });
    }, 500);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on exactly what the check depends on
  }, [key]);
  return flags;
}
