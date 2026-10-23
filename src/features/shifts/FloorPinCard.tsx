import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { shiftService } from "./api";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR PIN, ON THE SHIFT CARD
//
//  What the supervisor types on the floor tablet (/floor) to open this
//  shift's entry screen. Made the first time it is shown; shown only
//  on request, so a screen left open in the office does not read it
//  out to the room. "New PIN" ends every session opened with the old
//  one — for when the PIN has gone further than it should.
// ══════════════════════════════════════════════════════════════════

const when = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export function FloorPinCard({ dateKey, shift }: { dateKey: string; shift: "DAY" | "NIGHT" }) {
  const [shown, setShown] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["shifts", "floor-pin", dateKey, shift];

  const pin = useQuery({
    queryKey: key,
    queryFn: () => shiftService.floorPin(dateKey, shift),
    enabled: shown,
    refetchInterval: shown ? 30_000 : false,
  });
  const rotate = useMutation({
    mutationFn: () => shiftService.rotateFloorPin(dateKey, shift),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      setConfirm(false);
      toast("New PIN made — anyone on the floor with the old one has to enter this one", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not make a new PIN", "error"),
  });

  const copy = async () => {
    if (!pin.data) return;
    try {
      await navigator.clipboard.writeText(pin.data.pin);
      toast("PIN copied", "success");
    } catch {
      toast("Could not copy — read it off the card", "error");
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-ink-200 p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-ink-400" aria-hidden />
        <span className="text-sm font-medium">Floor PIN</span>
        <span className="ml-auto flex items-center gap-1">
          {shown && pin.data && (
            <button type="button" onClick={copy} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="Copy the PIN" title="Copy">
              <Copy className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            {shown ? <><EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide</> : <><Eye className="h-3.5 w-3.5" aria-hidden /> Show PIN</>}
          </button>
        </span>
      </div>

      {shown && (
        <div className="mt-2">
          {pin.isLoading && <p className="text-sm text-ink-400">Getting the PIN…</p>}
          {pin.isError && <p role="alert" className="text-sm text-status-danger">{pin.error instanceof ApiError ? pin.error.message : "Could not get the PIN."}</p>}
          {pin.data && (
            <>
              <p className="font-mono text-3xl font-bold tabular-nums tracking-[0.35em]" aria-label={`PIN ${pin.data.pin.split("").join(" ")}`}>
                {pin.data.pin}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                {pin.data.opens.length
                  ? `Opened by ${pin.data.opens.slice(0, 3).map((o) => `${o.name} at ${when(o.at)}`).join(", ")}${pin.data.opens.length > 3 ? ` and ${pin.data.opens.length - 3} more` : ""}.`
                  : "Nobody has opened the floor with it yet."}
                {pin.data.failedAttempts > 0 && ` ${pin.data.failedAttempts} wrong tr${pin.data.failedAttempts === 1 ? "y" : "ies"}.`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirm(true)}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> New PIN
                </Button>
                <a href="/floor" target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-600 hover:underline">
                  Open the floor screen
                </a>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Make a new PIN?"
        message="Anyone on the floor who opened this shift with the current PIN will have to enter the new one. Nothing they entered is lost."
        confirmLabel="New PIN"
        loading={rotate.isPending}
        onConfirm={() => rotate.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
