import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useLotMutations, useLotTrace } from "./hooks";
import { YarnLot, YarnLotStatus } from "./types";

/**
 * Dye lots of one material.
 *
 * Lot balances do NOT add up to the material's stock, and the panel says
 * so rather than leaving people to discover it: stock is debited when an
 * order is approved, a lot when the yarn physically leaves the rack for
 * a warping batch.
 */

const lotTone: Record<YarnLotStatus, ChipTone> = {
  open: "success",
  exhausted: "neutral",
  quarantined: "danger",
  closed: "neutral",
};

/**
 * A lot assigns stock that exists — the quantity is capped at what the
 * material holds and has not already been placed in another lot. Without
 * that it was free text, and a material holding 10 kg could carry a lot
 * claiming 500.
 */
const makeLotSchema = (unplaced: number) =>
  z.object({
    lotNo: z.string().min(1, "Lot number is required"),
    quantity: z.coerce
      .number()
      .positive("Quantity must be greater than zero")
      .max(unplaced, `Only ${unplaced.toLocaleString("en-IN")} is unassigned`),
    shade: z.string().optional(),
    dyer: z.string().optional(),
    remarks: z.string().optional(),
  });
type LotValues = z.infer<ReturnType<typeof makeLotSchema>>;

function AddLotForm({
  unplaced,
  submitting,
  onSubmit,
  onCancel,
}: {
  unplaced: number;
  submitting: boolean;
  onSubmit: (v: LotValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState } = useForm<LotValues>({
    resolver: zodResolver(makeLotSchema(unplaced)),
  });

  return (
    // noValidate: the browser's own constraint check on max blocks the
    // submit silently, so the zod message explaining the cap never gets
    // rendered. Every other form here does the same.
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <p className="text-sm text-ink-400">
        For yarn already on the rack. Lots normally open themselves when a
        purchase order is received with a lot number against the line.
      </p>
      <p className="rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
        <span className="font-semibold tabular-nums">
          {unplaced.toLocaleString("en-IN")}
        </span>{" "}
        of this material is not yet assigned to a lot. A lot cannot claim more
        than that.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Lot no" placeholder="e.g. D-4471" error={formState.errors.lotNo?.message} {...register("lotNo")} />
        <Input
          label={`Quantity (kg) — up to ${unplaced.toLocaleString("en-IN")}`}
          type="number"
          step="0.01"
          max={unplaced}
          error={formState.errors.quantity?.message}
          {...register("quantity")}
        />
        <Input label="Shade" placeholder="e.g. Off White" {...register("shade")} />
        <Input label="Dye house" placeholder="Optional" {...register("dyer")} />
      </div>
      <Input label="Remarks" placeholder="Optional" {...register("remarks")} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Open lot</Button>
      </div>
    </form>
  );
}

/** Where a lot went — the question a shade complaint starts from. */
function LotTrace({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const { data, isLoading } = useLotTrace(lotId);

  return (
    <FormScreen open onClose={onClose} title={`Lot ${data?.lot.lotNo ?? ""} — where it went`} width="max-w-2xl">
      {isLoading && <p className="text-sm text-ink-400">Loading…</p>}
      {data && data.batches.length === 0 && (
        <EmptyState
          title="Not issued yet"
          description="This lot has not been drawn into a warping batch."
        />
      )}
      {data && data.batches.length > 0 && (
        <>
          <p className="mb-3 text-sm text-ink-600">
            <span className="font-semibold tabular-nums">{data.issuedQty.toLocaleString("en-IN")}</span> kg
            issued across {data.batches.filter((b) => b.status !== "cancelled").length} live batch
            {data.batches.filter((b) => b.status !== "cancelled").length === 1 ? "" : "es"}.
          </p>
          <div className="space-y-2">
            {data.batches.map((b) => (
              <div
                key={b.batchId}
                className={`rounded-lg border border-ink-200 p-3 text-sm ${
                  b.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.batchNo}</span>
                  <StatusChip tone={b.status === "cancelled" ? "neutral" : "info"}>{b.status}</StatusChip>
                  <span className="tabular-nums text-ink-600">{b.quantity.toLocaleString("en-IN")} kg</span>
                  {b.beamNos.length > 0 && (
                    <span className="text-xs text-ink-400">beam {b.beamNos.join(", ")}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {b.job ? `Job #${b.job.jobOrderNo}` : "No job"}
                  {b.order?.customer ? ` · ${b.order.customer}` : ""}
                  {b.order?.po ? ` · PO ${b.order.po}` : ""}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </FormScreen>
  );
}

export function MaterialLots({
  materialId,
  lots,
  unplaced = 0,
}: {
  materialId: string;
  lots: YarnLot[];
  /** Stock not yet assigned to any lot — the ceiling for a new lot. */
  unplaced?: number;
}) {
  const { toast } = useToast();
  const { create, setStatus } = useLotMutations();
  const [addOpen, setAddOpen] = useState(false);
  const [tracing, setTracing] = useState<string | null>(null);

  const onRack = lots
    .filter((l) => l.status === "open")
    .reduce((s, l) => s + l.balance, 0);

  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div>
            <h3 className="font-semibold">Dye lots</h3>
            <p className="text-xs text-ink-400">
              {onRack.toLocaleString("en-IN")} kg on the rack across open lots. Lot balances
              track physical yarn and will not match stock, which is committed at order approval.
            </p>
            {/* What is left to assign. A lot is an assignment of stock that
                exists, so this is the ceiling on opening one by hand. */}
            <p className="text-xs">
              {unplaced > 0 ? (
                <span className="text-ink-600">
                  <span className="font-semibold tabular-nums">
                    {unplaced.toLocaleString("en-IN")}
                  </span>{" "}
                  not yet assigned to a lot
                </span>
              ) : (
                <span className="text-ink-400">All stock is accounted for by lots</span>
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={unplaced <= 0}
            title={
              unplaced <= 0
                ? "No unassigned stock — receive or adjust stock in first"
                : undefined
            }
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add lot
          </Button>
        </div>

        {lots.length === 0 ? (
          <EmptyState
            title="No lots recorded"
            description="Receive a purchase order with a lot number, or add a lot for yarn already on the rack."
            icon={<Layers className="h-6 w-6" />}
          />
        ) : (
          <div className="mt-3 divide-y divide-ink-100">
            {lots.map((lot) => (
              <div key={lot._id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{lot.lotNo}</span>
                    <StatusChip tone={lotTone[lot.status]}>{lot.status}</StatusChip>
                    {lot.shade && <span className="text-xs text-ink-400">{lot.shade}</span>}
                  </div>
                  <p className="text-xs text-ink-400">
                    received {lot.receivedQty.toLocaleString("en-IN")} · issued{" "}
                    {lot.consumedQty.toLocaleString("en-IN")}
                    {lot.remarks ? ` · ${lot.remarks}` : ""}
                  </p>
                </div>
                <span className="tabular-nums font-semibold">
                  {lot.balance.toLocaleString("en-IN")} kg
                </span>
                <Button size="sm" variant="ghost" onClick={() => setTracing(lot._id)}>
                  Trace
                </Button>
                {/* Quarantine is how a shade complaint stops the rest of a
                    bad lot reaching the floor. */}
                {lot.status === "quarantined" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate(
                        { id: lot._id, status: "open" },
                        {
                          onSuccess: () => toast(`Lot ${lot.lotNo} released`, "success"),
                          onError: (e) =>
                            toast(e instanceof ApiError ? e.message : "Release failed", "error"),
                        }
                      )
                    }
                  >
                    <ShieldCheck className="h-4 w-4" /> Release
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate(
                        { id: lot._id, status: "quarantined" },
                        {
                          onSuccess: () => toast(`Lot ${lot.lotNo} held back`, "success"),
                          onError: (e) =>
                            toast(e instanceof ApiError ? e.message : "Hold failed", "error"),
                        }
                      )
                    }
                  >
                    <ShieldAlert className="h-4 w-4" /> Hold
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <FormScreen open={addOpen} onClose={() => setAddOpen(false)} title="Add a dye lot">
        <AddLotForm
          unplaced={unplaced}
          submitting={create.isPending}
          onCancel={() => setAddOpen(false)}
          onSubmit={(v) =>
            create.mutate(
              { rawMaterial: materialId, ...v },
              {
                onSuccess: () => {
                  setAddOpen(false);
                  toast(`Lot ${v.lotNo} opened`, "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Could not open lot", "error"),
              }
            )
          }
        />
      </FormScreen>

      {tracing && <LotTrace lotId={tracing} onClose={() => setTracing(null)} />}
    </>
  );
}
