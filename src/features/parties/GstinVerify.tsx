import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { httpClient } from "@/core/http/httpClient";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";
import { formatDate } from "@/core/format/date";
import { gstinInfo } from "./gstin";

// ══════════════════════════════════════════════════════════════════
//  "VERIFY" BESIDE THE GSTIN — customer and supplier forms
//
//  The server checks the number itself first (pattern, check character)
//  and then asks the GST system, through whoever is connected in
//  Settings → Invoice, who it is registered to, where, and whether it is
//  still active. What comes back fills the form.
//
//  What is filled, and what is not:
//    • an empty field takes the registration's value;
//    • a field somebody already typed in is left alone and listed, with
//      one click to take the registration's value instead — a name the
//      office knows the firm by is not overwritten behind its back;
//    • what Verify itself put there is Verify's to replace: check a
//      second number and the first one's address does not stay behind.
//      Where it would (the second number has no registration to fill
//      from), the form says whose details it still holds, with one click
//      to clear them — one firm's address under another's GSTIN is how
//      an invoice goes out wrong;
//    • a registration that is cancelled, suspended or inactive fills
//      nothing by itself: it says so, and offers the details;
//    • opening a party that was checked before shows that check, and
//      changes nothing.
//
//  The result belongs to the number it was made for: change the GSTIN
//  and it is no longer shown.
// ══════════════════════════════════════════════════════════════════

type Kind = "customer" | "supplier";
const base: Record<Kind, string> = { customer: "/customer", supplier: "/supplier" };

export interface GstinFill {
  /** What the business is known by: its trade name, else its legal name. */
  name: string;
  legalName: string;
  tradeName: string;
  address: string;
  city: string;
  pincode: string;
  stateCode: string;
  /** The whole address on one line, for a form with one address field. */
  fullAddress: string;
  pan: string;
  gstRegistration: "regular" | "composition";
  sez: boolean;
}

export type GstinStatus = "active" | "cancelled" | "suspended" | "inactive" | "provisional" | "unknown";

export interface GstinPortal {
  /** false: the GST system was not asked — `reason` says why. */
  checked: boolean;
  reason?: "checksum" | "not_connected";
  found?: boolean;
  fromCache?: boolean;
  checkedAt?: string;
  checkedByName?: string;
  via?: string;
  said?: string;
  status?: GstinStatus;
  statusText?: string;
  legalName?: string;
  tradeName?: string;
  taxpayerType?: string;
  registeredOn?: string;
  cancelledOn?: string;
  einvoiceBlocked?: boolean | null;
}

export interface GstinAnswer {
  gstin: string;
  valid: boolean;
  checksumOk: boolean;
  stateCode: string;
  stateName: string;
  pan: string;
  portal: GstinPortal;
  fill: GstinFill | null;
  message: string;
}

/** One form field and the part of the registration that goes in it. */
export interface FillTarget<F extends string = string> {
  field: F;
  label: string;
  from: "name" | "address" | "fullAddress" | "city" | "pincode" | "stateCode" | "pan";
}

interface Kept { field: string; label: string; current: string; value: string }

const clean = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();
const normal = (raw: string) => String(raw ?? "").replace(/\s+/g, "").toUpperCase();

/** Statuses a form may be filled from without being asked. */
const LIVE: GstinStatus[] = ["active", "provisional", "unknown"];

export interface GstinVerifyState {
  busy: boolean;
  /** Whether there is a GSTIN to check: fifteen characters in the pattern. */
  canVerify: boolean;
  error: string;
  /** The answer for the GSTIN now in the field, or null. */
  answer: GstinAnswer | null;
  /** Shown from an earlier check when the party was opened; nothing was filled. */
  fromEarlier: boolean;
  filled: string[];
  kept: Kept[];
  /** The details came back and have not been put in the form. */
  canFill: boolean;
  /** The name now in the form, for offering the other of the two names. */
  nameNow: string;
  nameField: string | null;
  nameLabel: string;
  /** Fields still holding what an earlier check filled in, for another GSTIN. */
  stale: string[];
  staleFrom: string;
  verify: (fresh?: boolean) => void;
  fill: () => void;
  use: (field: string, value: string, label: string) => void;
  clearStale: () => void;
}

export function useGstinVerify<F extends string>({
  kind,
  gstin,
  targets,
  read,
  write,
  facts,
  showEarlier = false,
}: {
  kind: Kind;
  /** The GSTIN as it stands in the form. */
  gstin: string;
  targets: FillTarget<F>[];
  read: (field: F) => string;
  write: (field: F, value: string) => void;
  /**
   * What the form holds that is not text — a tick box, a choice. Called
   * when the form is filled; returns what it changed, in words.
   */
  facts?: (fill: GstinFill) => string[];
  /** An existing party: show the check kept for its GSTIN, if any. */
  showEarlier?: boolean;
}): GstinVerifyState {
  const g = normal(gstin);
  const canVerify = gstinInfo(g).valid;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ gstin: string; message: string } | null>(null);
  const [answer, setAnswer] = useState<GstinAnswer | null>(null);
  const [fromEarlier, setFromEarlier] = useState(false);
  const [applied, setApplied] = useState(false);
  const [filled, setFilled] = useState<string[]>([]);
  const [kept, setKept] = useState<Kept[]>([]);
  // The newest request wins: an answer for a number since changed, or
  // one overtaken by "Check again", is dropped.
  const turn = useRef(0);
  // What Verify put in each field, and for which GSTIN: a value still
  // standing as Verify wrote it was not typed by anybody.
  const wrote = useRef(new Map<string, { value: string; gstin: string }>());
  const [, redraw] = useState(0);

  /** Put `from` in the form: empty fields are filled, typed ones are listed. */
  const apply = useCallback((from: Partial<GstinFill>, whole: GstinFill | null, forGstin: string) => {
    const done: string[] = [];
    const left: Kept[] = [];
    for (const t of targets) {
      const value = clean(from[t.from] ?? "");
      if (!value) continue;
      const current = clean(read(t.field));
      const mine = wrote.current.get(t.field);
      const ours = !!mine && same(current, mine.value);
      if (same(current, value)) {
        // Already there. If it stood from another number's check, it is this number's now.
        if (ours) wrote.current.set(t.field, { value, gstin: forGstin });
      } else if (!current || ours) {
        write(t.field, value);
        wrote.current.set(t.field, { value, gstin: forGstin });
        done.push(t.label);
      } else {
        left.push({ field: t.field, label: t.label, current, value });
      }
    }
    if (whole) done.push(...(facts?.(whole) ?? []));
    setFilled(done); setKept(left); setApplied(!!whole);
  }, [targets, read, write, facts]);

  const verify = useCallback((fresh = false) => {
    if (!canVerify || busy) return;
    const mine = ++turn.current;
    setBusy(true); setError(null);
    httpClient.post<GstinAnswer>(`${base[kind]}/gstin/${encodeURIComponent(g)}/verify`, fresh ? { fresh: true } : {}, { timeoutMs: MODEL_TIMEOUT_MS })
      .then((a) => {
        if (mine !== turn.current) return;
        setAnswer(a); setFromEarlier(false); setFilled([]); setKept([]); setApplied(false);
        if (a.fill && a.portal.found && LIVE.includes(a.portal.status ?? "unknown")) apply(a.fill, a.fill, a.gstin);
        // Nobody was asked, but the number itself gives two of the fields.
        else if (!a.portal.checked && a.checksumOk) apply({ stateCode: a.stateCode, pan: a.pan }, null, a.gstin);
      })
      .catch((e: unknown) => {
        if (mine !== turn.current) return;
        setAnswer(null);
        setError({ gstin: g, message: e instanceof Error && e.message ? e.message : "The GSTIN could not be checked. Try again." });
      })
      .finally(() => { if (mine === turn.current) setBusy(false); });
  }, [canVerify, busy, kind, g, apply]);

  // An existing party: what the last check of its GSTIN said. Asked once,
  // for the number the form opened with; it fills nothing.
  const opened = useRef(g);
  useEffect(() => {
    if (!showEarlier || !gstinInfo(opened.current).valid) return;
    let live = true;
    const mine = turn.current;
    Promise.resolve()
      .then(() => httpClient.get<{ check?: GstinAnswer | null }>(`${base[kind]}/gstin/${encodeURIComponent(opened.current)}/check`))
      .then((r) => {
        if (!live || mine !== turn.current || !r?.check?.portal?.checked) return;
        setAnswer(r.check); setFromEarlier(true);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [kind, showEarlier]);

  const shown = answer && answer.gstin === g ? answer : null;
  const nameTarget = targets.find((t) => t.from === "name") ?? null;
  // Fields still holding what a check of ANOTHER number filled in. Said
  // once a whole other GSTIN stands in the field, not at every keystroke
  // on the way to it.
  const staleNow = () => (canVerify ? targets.filter((t) => {
    const mine = wrote.current.get(t.field);
    return !!mine && mine.gstin !== g && same(read(t.field), mine.value);
  }) : []);
  const stale = staleNow();

  return {
    busy,
    canVerify,
    error: error && error.gstin === g ? error.message : "",
    answer: shown,
    fromEarlier: !!shown && fromEarlier,
    filled: shown ? filled : [],
    kept: shown ? kept : [],
    canFill: !!shown?.fill && !applied,
    nameNow: nameTarget ? clean(read(nameTarget.field)) : "",
    nameField: nameTarget?.field ?? null,
    nameLabel: nameTarget?.label ?? "",
    stale: stale.map((t) => t.label),
    staleFrom: stale.length ? wrote.current.get(stale[0].field)?.gstin ?? "" : "",
    verify,
    fill: () => { if (shown?.fill) apply(shown.fill, shown.fill, shown.gstin); },
    use: (field, value, label) => {
      write(field as F, value);
      wrote.current.set(field, { value: clean(value), gstin: g });
      setKept((k) => k.filter((x) => x.field !== field));
      setFilled((f) => (f.includes(label) ? f : [...f, label]));
    },
    clearStale: () => {
      // Worked out again at the click: only what still stands as it was filled.
      for (const t of staleNow()) { write(t.field, ""); wrote.current.delete(t.field); }
      redraw((n) => n + 1);
    },
  };
}

/** The small button that sits beside the GSTIN field. */
export function GstinVerifyButton({ state, className }: { state: GstinVerifyState; className?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      className={cn("shrink-0 px-3", className)}
      loading={state.busy}
      disabled={!state.canVerify}
      title={state.canVerify ? "Check this GSTIN with the GST portal and fill the form from it" : "Type the 15-character GSTIN first"}
      onClick={() => state.verify(false)}
    >
      {!state.busy && <BadgeCheck className="h-4 w-4" />} Verify
    </Button>
  );
}

const TONE: Record<GstinStatus, ChipTone> = {
  active: "success", provisional: "info", unknown: "neutral", suspended: "warning", inactive: "warning", cancelled: "danger",
};

/** "18 Nov 2026, 3:42 pm" — when the GST system was asked. */
function when(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  return `${formatDate(d)}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "2017-07-01" → "1 Jul 2017". */
const day = (ymd?: string) => (ymd ? formatDate(`${ymd}T00:00:00`) : "");

/** What the check said, what was filled, and what was left as typed. */
export function GstinVerifyResult({ state }: { state: GstinVerifyState }) {
  const said = <Said state={state} />;
  if (!state.stale.length) return said;
  return (
    <>
      {said}
      <p role="note" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-status-warningBg p-2 text-xs text-status-warning">
        <span className="min-w-0 break-words">
          The form still holds what was filled in from {state.staleFrom}, a different GSTIN: {state.stale.join(", ")}.
        </span>
        <button type="button" className="font-semibold underline" onClick={state.clearStale}>Clear {state.stale.length === 1 ? "it" : "them"}</button>
      </p>
    </>
  );
}

function Said({ state }: { state: GstinVerifyState }) {
  const { answer: a, error } = state;
  if (error) return <p role="alert" className="rounded-lg bg-status-dangerBg p-2 text-sm text-status-danger">{error}</p>;
  if (!a) return null;
  const p = a.portal;

  // The GST system was not asked: a typo, or nobody is connected.
  if (!p.checked) {
    const typo = p.reason === "checksum";
    return (
      <div role={typo ? "alert" : "status"} className={cn("space-y-1 rounded-lg p-2 text-sm", typo ? "bg-status-warningBg text-status-warning" : "bg-ink-100 text-ink-700")}>
        <p>{a.message}</p>
        {state.filled.length > 0 && <p className="text-xs">Filled in from the number itself: {state.filled.join(", ")}.</p>}
      </div>
    );
  }

  if (!p.found) {
    return (
      <div role="alert" className="space-y-1 rounded-lg bg-status-warningBg p-2 text-sm text-status-warning">
        <p className="font-medium">{a.message}</p>
        <p className="text-xs">Nothing was filled in. Compare the number with their invoice or registration certificate.</p>
        <Footer state={state} />
      </div>
    );
  }

  const status = p.status ?? "unknown";
  const live = LIVE.includes(status);
  const names = [p.legalName, p.tradeName && !same(p.tradeName, p.legalName ?? "") ? `trade name ${p.tradeName}` : ""].filter(Boolean);
  const about = [
    p.taxpayerType,
    p.registeredOn ? `registered ${day(p.registeredOn)}` : "",
    p.cancelledOn ? `cancelled ${day(p.cancelledOn)}` : "",
  ].filter(Boolean).join(" · ");
  const f = a.fill;
  // The other of its two names, offered when the form holds one of them.
  const other = f && state.nameField && f.legalName && f.tradeName && !same(f.legalName, f.tradeName)
    ? (same(state.nameNow, f.tradeName) ? { value: f.legalName, what: "legal name" } : same(state.nameNow, f.legalName) ? { value: f.tradeName, what: "trade name" } : null)
    : null;

  return (
    <div
      role={live ? "status" : "alert"}
      aria-label="GSTIN check"
      className={cn("space-y-2 rounded-lg border p-3 text-sm", live ? "border-ink-200 bg-ink-50" : status === "cancelled" ? "border-status-danger bg-status-dangerBg" : "border-status-warning bg-status-warningBg")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={TONE[status]}>{`${p.statusText || "Status not given"} on the GST portal`}</StatusChip>
        {live && <span className="min-w-0 break-words font-medium text-ink-900">{names.join(" · ") || "Name not given"}</span>}
      </div>
      {/* Not a live registration: said in full, with what it means. */}
      {!live && <p className="font-medium text-ink-900">{a.message}</p>}
      {(about || f?.fullAddress) && (
        <p className="text-xs text-ink-600">
          {about}{about && f?.fullAddress ? <br /> : null}{f?.fullAddress}
        </p>
      )}
      {p.einvoiceBlocked && <p className="text-xs font-medium text-status-warning">The e-invoice system has this GSTIN blocked: an IRN cannot be raised on it.</p>}

      {state.canFill && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={state.fill}>Fill the form from this</Button>
          <span className="text-xs text-ink-500">{live ? "Empty fields are filled; what is typed stays." : "Nothing was filled in by itself."}</span>
        </div>
      )}
      {!state.canFill && f && (
        <p className="text-xs text-ink-700">
          {state.filled.length > 0 ? `Filled in: ${state.filled.join(", ")}.` : state.kept.length > 0 ? "Nothing was empty to fill." : "The form already matches the registration."}
        </p>
      )}
      {state.kept.map((k) => (
        <p key={k.field} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-700">
          <span className="min-w-0 break-words">{k.label} is kept as typed (“{k.current}”). The registration has “{k.value}”.</span>
          <button type="button" className="font-semibold text-brand-600 underline" onClick={() => state.use(k.field, k.value, k.label)}>Use the registration's</button>
        </p>
      ))}
      {other && state.nameField && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-700">
          <span className="min-w-0 break-words">Its {other.what} is “{other.value}”.</span>
          <button type="button" className="font-semibold text-brand-600 underline" onClick={() => state.use(state.nameField as string, other.value, state.nameLabel)}>Use the {other.what}</button>
        </p>
      )}
      <Footer state={state} />
    </div>
  );
}

function Footer({ state }: { state: GstinVerifyState }) {
  const p = state.answer?.portal;
  if (!p) return null;
  const said = [`Checked ${when(p.checkedAt)}`.trim(), p.via ? `through ${p.via}` : "", p.checkedByName ? `by ${p.checkedByName}` : ""].filter(Boolean).join(" ");
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
      <span>{state.fromEarlier ? `Last check: ${said.replace(/^Checked /, "")}` : said}.</span>
      <button type="button" className="font-semibold text-brand-600 underline disabled:opacity-50" disabled={state.busy} onClick={() => state.verify(true)}>Check again</button>
    </p>
  );
}
