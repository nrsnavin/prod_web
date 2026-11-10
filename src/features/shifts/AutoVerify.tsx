import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BellRing, Repeat, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InlineConfirm } from "@/components/ui/InlineConfirm";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/core/auth/useAuth";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { shiftService } from "./api";

// ══════════════════════════════════════════════════════════════════
//  VERIFIED BY THE RULE
//
//  An entry whose run time was read off a photo of the timer, with no
//  remark, and whose metres a head are within the tolerance of what the
//  loom makes in that run time (its own rate, learned from enough of its
//  shifts), is verified as it is saved — when an admin has turned that
//  on. The office sees each one here with what it was checked against,
//  to spot-check, and only the rest wait in the list below.
// ══════════════════════════════════════════════════════════════════

export function AutoVerifySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["production-settings"], queryFn: shiftService.productionSettings });
  const [tolerance, setTolerance] = useState<string | null>(null);
  const [minShifts, setMinShifts] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const isAdmin = user?.role === "admin";
  const a = data.autoVerify;
  const save = async (autoVerify: Partial<typeof a>) => {
    setBusy(true);
    try {
      qc.setQueryData(["production-settings"], await shiftService.saveProductionSettings({ autoVerify }));
      setTolerance(null); setMinShifts(null);
      toast("Saved", "success");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Card className="mb-4 p-4" aria-label="Auto-verification">
      <div className="flex flex-wrap items-center gap-3">
        <Settings2 className="h-4 w-4 text-ink-400" aria-hidden />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={a.enabled} disabled={!isAdmin || busy} onChange={(e) => save({ enabled: e.target.checked })} aria-label="Verify entries automatically" />
          Verify entries automatically when the photo and the loom's rate agree
        </label>
        <StatusChip tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "on" : "off"}</StatusChip>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        Only an entry whose run time was read off a photo of the timer, with no remark, and whose metres a head are within ±{a.tolerancePct}% of what that loom makes in that time — its own rate, learned from at least {a.minShifts} of its shifts. Everything else waits here as now.{!isAdmin ? " An admin can change this." : ""}
      </p>
      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="Within ± %" type="number" min={1} max={50} className="w-28" value={tolerance ?? String(a.tolerancePct)} onChange={(e) => setTolerance(e.target.value)} />
          <Input label="Loom's own shifts, at least" type="number" min={1} max={200} className="w-40" value={minShifts ?? String(a.minShifts)} onChange={(e) => setMinShifts(e.target.value)} />
          <Button size="sm" variant="secondary" loading={busy} disabled={tolerance === null && minShifts === null} onClick={() => save({ ...(tolerance !== null ? { tolerancePct: Number(tolerance) } : {}), ...(minShifts !== null ? { minShifts: Number(minShifts) } : {}) })}>Save</Button>
        </div>
      )}
    </Card>
  );
}

/**
 * The work page's one line about it: whether entries are verified as
 * they are saved, and the way to the settings, which no longer sit on
 * top of the queue they exist for.
 */
export function AutoVerifyNote({ onSettings }: { onSettings: () => void }) {
  const { data } = useQuery({ queryKey: ["production-settings"], queryFn: shiftService.productionSettings });
  if (!data) return null;
  const a = data.autoVerify;
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500" aria-label="Auto-verification">
      <StatusChip tone={a.enabled ? "success" : "neutral"}>{a.enabled ? "Auto-verify on" : "Auto-verify off"}</StatusChip>
      <span>
        {a.enabled
          ? `Entries within ±${a.tolerancePct}% of the loom's own rate are verified as they are saved; the rest wait here.`
          : "Every entry waits here for you."}
      </span>
      <button type="button" onClick={onSettings} className="font-medium text-brand-600 hover:underline">
        Settings
      </button>
    </p>
  );
}

/**
 * Before each shift ends, a WhatsApp message naming the looms not
 * entered yet (services/shiftEndNudge.js on the server).
 */
export function ShiftEndReminderSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["production-settings"], queryFn: shiftService.productionSettings });
  const [minutes, setMinutes] = useState<string | null>(null);
  const [phones, setPhones] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  if (!data) return null;
  const isAdmin = user?.role === "admin";
  const n = data.shiftEndNudge;
  const save = async (shiftEndNudge: Parameters<typeof shiftService.saveProductionSettings>[0]["shiftEndNudge"]) => {
    setBusy(true);
    try {
      qc.setQueryData(["production-settings"], await shiftService.saveProductionSettings({ shiftEndNudge }));
      setMinutes(null); setPhones(null);
      toast("Saved", "success");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); }
    finally { setBusy(false); }
  };
  const sendNow = async () => {
    setSending(true);
    try {
      const r = await shiftService.sendShiftEndNudge();
      toast(r.sent ? `Sent — ${r.looms?.length ?? 0} loom${r.looms?.length === 1 ? "" : "s"} to enter` : r.why === "every loom is entered" ? "Every loom on this shift is entered — nothing to send" : `Not sent: ${r.why ?? "unknown"}`, r.sent ? "success" : "info");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not send", "error"); }
    finally { setSending(false); }
  };
  return (
    <Card className="mb-4 p-4" aria-label="Shift-end reminder">
      <div className="flex flex-wrap items-center gap-3">
        <BellRing className="h-4 w-4 text-ink-400" aria-hidden />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={n.enabled} disabled={!isAdmin || busy} onChange={(e) => save({ enabled: e.target.checked })} aria-label="Remind before the shift ends" />
          Remind on WhatsApp before the shift ends, naming the looms not entered
        </label>
        <StatusChip tone={n.enabled ? "success" : "neutral"}>{n.enabled ? "on" : "off"}</StatusChip>
      </div>
      <p className="mt-1 text-xs text-ink-400">
        {n.minutesBefore} minutes before 8 AM and 8 PM, once a shift, to {n.phones.length ? n.phones.join(", ") : "the notification recipients"}. Nothing is sent when every loom is in.{!isAdmin ? " An admin can change this." : ""}
      </p>
      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="Minutes before" type="number" min={5} max={240} className="w-28" value={minutes ?? String(n.minutesBefore)} onChange={(e) => setMinutes(e.target.value)} />
          <Input label="WhatsApp numbers (comma between)" className="w-72" placeholder="Empty: the notification recipients" value={phones ?? n.phones.join(", ")} onChange={(e) => setPhones(e.target.value)} />
          <Button size="sm" variant="secondary" loading={busy} disabled={minutes === null && phones === null} onClick={() => save({ ...(minutes !== null ? { minutesBefore: Number(minutes) } : {}), ...(phones !== null ? { phones } : {}) })}>Save</Button>
          {/* A WhatsApp goes out at once, so it asks in place, naming who gets it. */}
          <InlineConfirm loading={sending} onConfirm={() => void sendNow()} confirmLabel="Send reminder"
            question={`Send the reminder now to ${n.phones.length ? n.phones.join(", ") : "the notification recipients"}?`}>
            Send now…
          </InlineConfirm>
        </div>
      )}
    </Card>
  );
}

/**
 * After each shift, a WhatsApp handover to the owner and the next
 * supervisor: metres against what the looms usually make, looms not
 * entered or down, open issues, and what to watch (services/shiftHandover.js).
 */
export function ShiftHandoverSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["production-settings"], queryFn: shiftService.productionSettings });
  const [phones, setPhones] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!data) return null;
  const isAdmin = user?.role === "admin";
  const h = data.shiftHandover ?? { enabled: false, withinMinutes: 60, phones: [] };
  const save = async (shiftHandover: { enabled?: boolean; phones?: string }) => {
    setBusy(true);
    try {
      qc.setQueryData(["production-settings"], await shiftService.saveProductionSettings({ shiftHandover }));
      setPhones(null);
      toast("Saved", "success");
    } catch (e) { toast(e instanceof ApiError ? e.message : "Could not save", "error"); }
    finally { setBusy(false); }
  };
  const show = async () => {
    setLoading(true);
    try { setPreview((await shiftService.handover()).text); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not build the handover", "error"); }
    finally { setLoading(false); }
  };
  const sendNow = async () => {
    setBusy(true);
    try { const r = await shiftService.sendHandover(); toast(r.sent ? "Handover sent" : `Not sent: ${r.why ?? "unknown"}`, r.sent ? "success" : "info"); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not send", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Card className="mb-4 p-4" aria-label="Shift handover">
      <div className="flex flex-wrap items-center gap-3">
        <Repeat className="h-4 w-4 text-ink-400" aria-hidden />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={h.enabled} disabled={!isAdmin || busy} onChange={(e) => save({ enabled: e.target.checked })} aria-label="Send the shift handover" />
          Send a handover on WhatsApp after each shift
        </label>
        <StatusChip tone={h.enabled ? "success" : "neutral"}>{h.enabled ? "on" : "off"}</StatusChip>
        <Button size="sm" variant="ghost" loading={loading} onClick={show}>See the last shift's</Button>
      </div>
      <p className="mt-1 text-xs text-ink-400">Metres made against what the looms usually make, looms not entered or down, open machine issues, and what the next shift should watch — to {h.phones.length ? h.phones.join(", ") : "the notification recipients"}.</p>
      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input label="Handover numbers (comma between)" className="w-72" placeholder="Empty: the notification recipients" value={phones ?? h.phones.join(", ")} onChange={(e) => setPhones(e.target.value)} />
          <Button size="sm" variant="secondary" loading={busy} disabled={phones === null} onClick={() => save({ phones: phones ?? "" })}>Save</Button>
          <InlineConfirm loading={busy} onConfirm={() => void sendNow()} confirmLabel="Send handover"
            question={`Send the last shift's handover now to ${h.phones.length ? h.phones.join(", ") : "the notification recipients"}?`}>
            Send now…
          </InlineConfirm>
        </div>
      )}
      {preview && <pre role="note" className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-50 p-3 font-sans text-sm text-ink-700">{preview}</pre>}
    </Card>
  );
}

export function AutoVerifiedList() {
  const { data } = useQuery({ queryKey: ["auto-verified"], queryFn: () => shiftService.autoVerified(2) });
  if (!data?.length) return null;
  return (
    <Card className="mt-6 p-4" aria-label="Verified automatically">
      <h3 className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-4 w-4 text-status-success" aria-hidden /> Verified automatically — last 2 days ({data.length})</h3>
      <p className="text-xs text-ink-400">Each with what it was checked against. Open one from the shift plan to correct it, as with any verified entry.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-200 text-xs text-ink-500 font-medium"><th className="py-1.5 text-left font-medium">Shift</th><th className="py-1.5 text-left font-medium">Loom</th><th className="py-1.5 text-left font-medium">Operator</th><th className="py-1.5 text-right font-medium">Run time</th><th className="py-1.5 text-right font-medium">Entered / head</th><th className="py-1.5 text-right font-medium">Expected</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {data.map((r) => (
              <tr key={r._id}>
                <td className="py-1.5">{formatDate(r.date)} · {r.shift}</td>
                <td className="py-1.5 font-medium">{r.machine}</td>
                <td className="py-1.5">{r.operator || "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{r.timer}</td>
                <td className="py-1.5 text-right tabular-nums">{r.perHead} m</td>
                <td className="py-1.5 text-right tabular-nums text-ink-500">{r.expected} m <span className="text-xs">({r.low}–{r.high}, {r.shifts} shifts)</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
