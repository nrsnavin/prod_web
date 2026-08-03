import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useLotMutations } from "./hooks";
import type { YarnLot } from "./types";

const MIN_REASON = 3;

/**
 * Correct one lot's balance — a recount, damage, spillage.
 *
 * Two things it is careful about:
 *
 *  • The lot and the material's aggregate stock move TOGETHER, in one
 *    transaction server-side. Lot balances are a subdivision of stock,
 *    so correcting one alone puts the two permanently out of step and
 *    nothing afterwards can say which is right. The dialog says so,
 *    because someone adjusting a lot needs to know the material figure
 *    moves with it.
 *  • A reason is required. An adjustment has no document behind it, so
 *    without one the ledger row is a number nobody can explain — which
 *    is exactly what a ledger exists to prevent.
 */
export function LotAdjustDialog({ lot, onClose }: { lot: YarnLot; onClose: () => void }) {
  const { toast } = useToast();
  const { adjust } = useLotMutations();
  const [deltaText, setDeltaText] = useState("");
  const [reason, setReason] = useState("");

  const delta = Number(deltaText);
  const validDelta = Number.isFinite(delta) && delta !== 0;
  const after = validDelta ? lot.balance + delta : lot.balance;
  // Taking more off than the lot holds would drive it negative, and the
  // shade trail would then claim yarn that was never there. The server
  // refuses; saying so here saves the round trip.
  const overdrawn = validDelta && after < 0;
  const blocked = !validDelta || overdrawn || reason.trim().length < MIN_REASON;

  const submit = () =>
    adjust.mutate(
      { id: lot._id, delta, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`Lot ${lot.lotNo} adjusted`, "success");
          onClose();
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Adjustment failed", "error"),
      }
    );

  return (
    <Modal open onClose={onClose} title={`Adjust lot ${lot.lotNo}`} width="max-w-md">
      <p className="text-sm text-ink-600">
        {lot.lotNo} holds{" "}
        <span className="font-semibold tabular-nums">
          {lot.balance.toLocaleString("en-IN")} kg
        </span>
        . The material&rsquo;s total stock moves by the same amount — a lot corrected on
        its own would leave the two disagreeing.
      </p>

      <div className="mt-4 space-y-3">
        <Input
          label="Change (kg)"
          type="number"
          step="0.01"
          placeholder="e.g. -12 for a shortfall"
          aria-label="Adjustment in kg"
          value={deltaText}
          onChange={(e) => setDeltaText(e.target.value)}
          error={overdrawn ? `That is more than the ${lot.balance} kg on this lot.` : undefined}
        />

        {validDelta && !overdrawn && (
          <p className="text-xs text-ink-500">
            {lot.balance.toLocaleString("en-IN")} → {after.toLocaleString("en-IN")} kg
            {after === 0 ? " · the lot will be marked exhausted" : ""}
          </p>
        )}

        <Input
          label="Reason"
          placeholder="e.g. annual recount, spillage"
          aria-label="Reason for the adjustment"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="text-xs text-ink-400">
          Kept on the lot&rsquo;s ledger and on the material&rsquo;s, so the correction can be
          explained later rather than only seen.
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={adjust.isPending}>
          Cancel
        </Button>
        <Button disabled={blocked} loading={adjust.isPending} onClick={submit}>
          Adjust lot
        </Button>
      </div>
    </Modal>
  );
}
