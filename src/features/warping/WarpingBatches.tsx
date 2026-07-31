import { useMemo, useState } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useYarnLots } from "@/features/materials/hooks";
import { useBatchMutations, useWarpingBatches } from "./hooks";
import { BatchStatus, WarpingPlan } from "./types";

/**
 * Running a warping plan in batches, each drawn from known dye lots.
 *
 * Yarn is dyed in lots and every lot takes the dye a little differently,
 * so two lots meeting inside one beam show as a shade band in the
 * finished elastic. Recording which lot went into which beam is what
 * makes a shade complaint answerable months later.
 */

const batchTone: Record<BatchStatus, ChipTone> = {
  planned: "neutral",
  issued: "info",
  completed: "success",
  cancelled: "danger",
};

/** Distinct warp yarns the plan calls for — the materials a batch can draw. */
function planYarns(plan?: WarpingPlan) {
  const seen = new Map<string, string>();
  for (const beam of plan?.beams ?? []) {
    for (const s of beam.sections ?? []) {
      if (s.warpYarn && typeof s.warpYarn === "object") {
        seen.set(s.warpYarn._id, s.warpYarn.name);
      }
    }
  }
  return Array.from(seen, ([id, name]) => ({ id, name }));
}

/** Lot picker for one material — only lots with something left on them. */
function LotPicker({
  materialId,
  materialName,
  value,
  onChange,
}: {
  materialId: string;
  materialName: string;
  value: { yarnLot: string; quantity: string };
  onChange: (v: { yarnLot: string; quantity: string }) => void;
}) {
  const { data: lots, isLoading } = useYarnLots({ material: materialId, issuable: true });
  const selected = lots?.find((l) => l._id === value.yarnLot);

  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <p className="text-sm font-medium">{materialName}</p>
      {isLoading && <p className="mt-1 text-xs text-ink-400">Loading lots…</p>}
      {!isLoading && (lots?.length ?? 0) === 0 && (
        <p className="mt-1 text-xs text-status-warning">
          No open lots for this yarn — receive a purchase order with a lot number, or add
          a lot on the material page.
        </p>
      )}
      {(lots?.length ?? 0) > 0 && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_130px]">
          <select
            aria-label={`Dye lot for ${materialName}`}
            value={value.yarnLot}
            onChange={(e) => onChange({ ...value, yarnLot: e.target.value })}
            className="h-9 rounded-lg border border-ink-200 bg-surface px-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">No lot</option>
            {lots!.map((l) => (
              <option key={l._id} value={l._id}>
                {l.lotNo}
                {l.shade ? ` · ${l.shade}` : ""} — {l.balance.toLocaleString("en-IN")} kg left
              </option>
            ))}
          </select>
          <Input
            type="number"
            step="0.01"
            min={0}
            aria-label={`Quantity from lot for ${materialName}`}
            placeholder="kg"
            value={value.quantity}
            onChange={(e) => onChange({ ...value, quantity: e.target.value })}
          />
        </div>
      )}
      {/* Warn before the server has to refuse — the operator can see the
          balance right there in the picker. */}
      {selected && Number(value.quantity) > selected.balance && (
        <p className="mt-1 text-xs text-status-danger">
          Only {selected.balance.toLocaleString("en-IN")} kg left on lot {selected.lotNo}.
        </p>
      )}
    </div>
  );
}

function NewBatchForm({
  plan,
  elasticOptions,
  submitting,
  onSubmit,
  onCancel,
}: {
  plan?: WarpingPlan;
  /** Elastics on the parent job — empty or single means nothing to choose. */
  elasticOptions: Array<{ id: string; name: string }>;
  submitting: boolean;
  onSubmit: (body: {
    beamNos: number[];
    allocations: Array<{ rawMaterial: string; yarnLot: string; quantity: number }>;
    elastics?: string[];
    remarks?: string;
  }) => void;
  onCancel: () => void;
}) {
  const yarns = useMemo(() => planYarns(plan), [plan]);
  const beams = (plan?.beams ?? []).map((b, i) => b.beamNo ?? i + 1);

  const [picked, setPicked] = useState<number[]>([]);
  const [forElastics, setForElastics] = useState<string[]>([]);
  const [alloc, setAlloc] = useState<Record<string, { yarnLot: string; quantity: string }>>({});
  const [remarks, setRemarks] = useState("");

  const allocations = yarns
    .map((y) => ({
      rawMaterial: y.id,
      yarnLot: alloc[y.id]?.yarnLot ?? "",
      quantity: Number(alloc[y.id]?.quantity) || 0,
    }))
    .filter((a) => a.yarnLot && a.quantity > 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Beams in this batch</p>
        <p className="text-xs text-ink-400">
          Leave all unticked if the batch is not tied to particular beams.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {beams.map((n) => (
            <label
              key={n}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                picked.includes(n)
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-ink-200"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={picked.includes(n)}
                onChange={(e) =>
                  setPicked((p) => (e.target.checked ? [...p, n] : p.filter((x) => x !== n)))
                }
              />
              Beam {n}
            </label>
          ))}
        </div>
      </div>

      {/* Only worth asking when there is a choice — a single-elastic job
          is filled in server-side. Without an answer the lot can only be
          traced as far as the job, which the notice below says outright. */}
      {elasticOptions.length > 1 && (
        <div>
          <p className="text-sm font-medium">Warping for</p>
          <p className="text-xs text-ink-400">
            Which elastic this batch is for. Leave it unset and the lot traces
            only as far as the job, not to a particular elastic.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {elasticOptions.map((e) => (
              <label
                key={e.id}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                  forElastics.includes(e.id)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={forElastics.includes(e.id)}
                  onChange={(ev) =>
                    setForElastics((p) =>
                      ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id)
                    )
                  }
                />
                {e.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium">Yarn drawn</p>
        <div className="mt-2 space-y-2">
          {yarns.length === 0 && (
            <p className="text-xs text-ink-400">
              This plan has no warp yarns on its sections yet.
            </p>
          )}
          {yarns.map((y) => (
            <LotPicker
              key={y.id}
              materialId={y.id}
              materialName={y.name}
              value={alloc[y.id] ?? { yarnLot: "", quantity: "" }}
              onChange={(v) => setAlloc((a) => ({ ...a, [y.id]: v }))}
            />
          ))}
        </div>
      </div>

      <Input
        label="Remarks"
        placeholder="Optional"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={allocations.length === 0}
          loading={submitting}
          onClick={() =>
            onSubmit({
              beamNos: picked,
              allocations,
              elastics: forElastics.length ? forElastics : undefined,
              remarks: remarks.trim() || undefined,
            })
          }
        >
          Create batch
        </Button>
      </div>
    </div>
  );
}

export function WarpingBatches({
  warpingId,
  plan,
  elasticOptions = [],
}: {
  warpingId: string;
  plan?: WarpingPlan;
  elasticOptions?: Array<{ id: string; name: string }>;
}) {
  const { toast } = useToast();
  const { data: batches } = useWarpingBatches(warpingId);
  const { create, issue, complete, cancel } = useBatchMutations();
  const [open, setOpen] = useState(false);

  const act = (
    mutation: typeof issue,
    id: string,
    msg: string
  ) =>
    mutation.mutate(id, {
      onSuccess: () => toast(msg, "success"),
      onError: (e) => toast(e instanceof ApiError ? e.message : "Action failed", "error"),
    });

  return (
    <>
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div>
            <h3 className="font-semibold">Batches</h3>
            <p className="text-xs text-ink-400">
              Which dye lots were drawn for which beams. Issuing moves the lot balance;
              it does not touch material stock, which was committed at order approval.
            </p>
          </div>
          <Button size="sm" variant="secondary" disabled={!plan} onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New batch
          </Button>
        </div>

        {!plan ? (
          <EmptyState
            title="No warping plan"
            description="Create the beam plan first — a batch is run against its beams."
            icon={<Boxes className="h-6 w-6" />}
          />
        ) : (batches?.length ?? 0) === 0 ? (
          <EmptyState
            title="No batches yet"
            description="Start a batch to record which yarn lots this programme is warped from."
            icon={<Boxes className="h-6 w-6" />}
          />
        ) : (
          <div className="mt-3 divide-y divide-ink-100">
            {batches!.map((b) => (
              <div key={b._id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{b.batchNo}</span>
                  <StatusChip tone={batchTone[b.status]}>{b.status}</StatusChip>
                  {b.beamNos.length > 0 && (
                    <span className="text-xs text-ink-400">beam {b.beamNos.join(", ")}</span>
                  )}
                  {/* Say when a batch is not pinned to an elastic, rather
                      than leaving the gap to be read as "all of them". */}
                  {(b.elastics?.length ?? 0) > 0 ? (
                    <span className="text-xs text-ink-600">
                      for{" "}
                      {b.elastics!
                        .map((e) => (typeof e === "object" ? e.name : e))
                        .join(", ")}
                    </span>
                  ) : (
                    <span className="text-xs text-status-warning">no elastic set</span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {b.status === "planned" && (
                      <Button size="sm" onClick={() => act(issue, b._id, `${b.batchNo} issued`)}>
                        Issue yarn
                      </Button>
                    )}
                    {b.status === "issued" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => act(complete, b._id, `${b.batchNo} completed`)}
                      >
                        Complete
                      </Button>
                    )}
                    {(b.status === "planned" || b.status === "issued") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          act(
                            cancel,
                            b._id,
                            b.status === "issued"
                              ? `${b.batchNo} cancelled — yarn returned to its lots`
                              : `${b.batchNo} cancelled`
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {b.allocations.map((a, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-ink-600">
                        {a.materialName || "Yarn"}
                        <span className="ml-2 font-medium">
                          lot {a.lotNo || "—"}
                          {a.shade ? ` · ${a.shade}` : ""}
                        </span>
                      </span>
                      <span className="tabular-nums text-ink-600">
                        {a.quantity.toLocaleString("en-IN")} kg
                      </span>
                    </li>
                  ))}
                </ul>
                {b.remarks && <p className="mt-1 text-xs text-ink-400">{b.remarks}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <FormScreen open={open} onClose={() => setOpen(false)} title="New warping batch" width="max-w-2xl">
        <NewBatchForm
          plan={plan}
          elasticOptions={elasticOptions}
          submitting={create.isPending}
          onCancel={() => setOpen(false)}
          onSubmit={(body) =>
            create.mutate(
              { warpingId, ...body },
              {
                onSuccess: (batch) => {
                  setOpen(false);
                  toast(`${batch.batchNo} created — issue it when the yarn is drawn`, "success");
                },
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Could not create batch", "error"),
              }
            )
          }
        />
      </FormScreen>
    </>
  );
}
