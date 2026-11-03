// The GSTIN, checked offline: two digits of state, the PAN, an entity
// number, Z, and a check character over the first fourteen (mod 36).
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstinCheckChar(first14: string) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function gstinInfo(raw: string): { valid: boolean; stateCode: string; pan: string; checksumOk: boolean } {
  const g = String(raw || "").trim().toUpperCase();
  if (!RE.test(g)) return { valid: false, stateCode: "", pan: "", checksumOk: false };
  return { valid: true, stateCode: g.slice(0, 2), pan: g.slice(2, 12), checksumOk: gstinCheckChar(g.slice(0, 14)) === g[14] };
}
