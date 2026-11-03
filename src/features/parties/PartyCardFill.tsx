import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IdCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { httpClient } from "@/core/http/httpClient";
import { useDebouncedValue } from "@/core/hooks/useDebouncedValue";
import { gstinInfo } from "./gstin";

export interface CardFields { name: string; contactName: string; phone: string; email: string; gstin: string; gstinChecksumOk?: boolean | null; address: string; city: string; pincode: string; stateCode: string }
export interface SimilarParty { _id: string; name: string; gstin?: string; phone?: string; why: string }
type Kind = "customer" | "supplier";
const base: Record<Kind, string> = { customer: "/customer", supplier: "/supplier" };
const detail: Record<Kind, (id: string) => string> = { customer: (id) => `/customers/${id}`, supplier: (id) => `/suppliers/${id}` };

/**
 * "Fill from a card": a visiting card, letterhead or invoice header read
 * into the form. Nothing is saved until the form is.
 */
export function CardFillButton({ kind, onFill }: { kind: Kind; onFill: (f: CardFields, aiSuggestion: string | null, similar: SimilarParty[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const read = async (file?: File) => {
    if (!file) return;
    setBusy(true); setNote("");
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch(`/api/v2${base[kind]}/read-card`, { method: "POST", body: fd, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Could not read the card");
      if (body.read?.problem) { setNote(body.read.problem === "not_a_card" ? "That does not look like a card or letterhead." : "The card could not be read — type the details in."); return; }
      onFill(body.read as CardFields, body.aiSuggestion ?? null, body.similar ?? []);
      setNote("Filled in from the card — check each field.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not read the card");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" aria-label="Card or letterhead photo" onChange={(e) => read(e.target.files?.[0])} />
      <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => ref.current?.click()}><IdCard className="h-4 w-4" /> Fill from a visiting card</Button>
      {note && <span className="text-xs text-ink-500">{note}</span>}
    </div>
  );
}

/** What the GSTIN says (state, PAN) and whether its check character holds. */
export function GstinHint({ gstin }: { gstin: string }) {
  const g = String(gstin || "").trim();
  if (!g) return null;
  const i = gstinInfo(g);
  if (!i.valid) return <p className="text-xs text-status-warning">Not a GSTIN: 15 characters, like 33AAECS1234F1Z5.</p>;
  return (
    <p className={`text-xs ${i.checksumOk ? "text-ink-500" : "text-status-warning"}`}>
      State {i.stateCode} · PAN {i.pan}{i.checksumOk ? "" : " · the last character does not match — check for a typo"}
    </p>
  );
}

/** Who on file looks the same, as the name, GSTIN and phone are typed. */
export function SimilarParties({ kind, name, gstin, phone, excludeId, seed }: { kind: Kind; name: string; gstin: string; phone: string; excludeId?: string; seed?: SimilarParty[] }) {
  const [list, setList] = useState<SimilarParty[]>(seed ?? []);
  const q = useDebouncedValue(`${name}|${gstin}|${phone}`, 500);
  useEffect(() => {
    const [n, g, p] = q.split("|");
    if (n.trim().length < 3 && g.trim().length !== 15 && p.replace(/\D/g, "").length !== 10) { setList([]); return; }
    let live = true;
    httpClient.get<{ success: boolean; similar: SimilarParty[] }>(`${base[kind]}/similar`, { name: n, gstin: g, phone: p, ...(excludeId ? { exclude: excludeId } : {}) })
      .then((r) => { if (live) setList(r.similar ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, [q, kind, excludeId]);
  if (!list.length) return null;
  return (
    <div role="alert" className="rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">
      Already on file? {list.map((s, i) => (
        <span key={s._id}>{i ? "; " : ""}<Link to={detail[kind](s._id)} className="font-semibold underline" target="_blank" rel="noreferrer">{s.name}</Link> ({s.why})</span>
      ))}. A second record splits their ledger and outstanding in two.
    </div>
  );
}
