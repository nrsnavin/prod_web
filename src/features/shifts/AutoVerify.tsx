import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

export function AutoVerifiedList() {
  const { data } = useQuery({ queryKey: ["auto-verified"], queryFn: () => shiftService.autoVerified(2) });
  if (!data?.length) return null;
  return (
    <Card className="mt-6 p-4" aria-label="Verified automatically">
      <h3 className="flex items-center gap-2 font-semibold"><BadgeCheck className="h-4 w-4 text-status-success" aria-hidden /> Verified automatically — last 2 days ({data.length})</h3>
      <p className="text-xs text-ink-400">Each with what it was checked against. Open one from the shift plan to correct it, as with any verified entry.</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400"><th className="py-1.5 text-left font-medium">Shift</th><th className="py-1.5 text-left font-medium">Loom</th><th className="py-1.5 text-left font-medium">Operator</th><th className="py-1.5 text-right font-medium">Run time</th><th className="py-1.5 text-right font-medium">Entered / head</th><th className="py-1.5 text-right font-medium">Expected</th></tr></thead>
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
