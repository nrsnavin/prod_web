// ══════════════════════════════════════════════════════════════════
//  WHAT A HEAD MAKES IN A RUN TIME — the plant's one rate, for now
//
//  Every loom is taken to weave 30 cm a minute a head. The entry
//  screens fill "production per head" from the run time at that rate,
//  so the supervisor types the run time and checks the metres rather
//  than working them out; the figure stays editable, and a head that
//  made more or less is simply typed over.
//
//  A rate per machine (from its RPM and the elastic's pick) comes
//  later; this is the one place it plugs in.
// ══════════════════════════════════════════════════════════════════

/** Centimetres a head weaves a minute, until a machine knows its own. */
export const DEFAULT_CM_PER_MIN = 30;

/** "7:30", "7.30", "730", "07:30:00" → minutes run; null when it cannot be read. */
export function runMinutes(raw: string): number | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[:.](\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) {
    const digits = t.match(/^(\d{3,4})$/);
    if (!digits) return null;
    const d = digits[1].padStart(4, "0");
    m = [t, d.slice(0, 2), d.slice(2)] as unknown as RegExpMatchArray;
  }
  const h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] != null ? Number(m[3]) : 0;
  if (mm > 59 || ss > 59) return null;
  return h * 60 + mm + ss / 60;
}

/**
 * Metres one head makes in the run time at the rate, to a tenth of a
 * metre; null when the run time cannot be read.
 */
export function expectedPerHead(runTime: string, cmPerMin = DEFAULT_CM_PER_MIN): number | null {
  const minutes = runMinutes(runTime);
  if (minutes == null) return null;
  return Math.round(minutes * cmPerMin) / 100;
}

/** The figure as the field shows it: "135", "135.5". */
export function perHeadText(runTime: string, cmPerMin = DEFAULT_CM_PER_MIN): string {
  const m = expectedPerHead(runTime, cmPerMin);
  return m == null ? "" : String(m);
}
