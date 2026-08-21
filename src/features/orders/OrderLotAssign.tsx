import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { orderService } from "./api";
import type {
  AssignableLot,
  OrderDetail,
  OrderLotEarmark,
  RawMaterialRequirement,
} from "./types";

/**
 * Which dye lots this order's yarn comes out of.
 *
 * Approving an order debits `RawMaterial.stock` without ever saying
 * which bags. For dyed yarn that omission costs something real: two
 * orders can both plan against the same 200 kg of D-4471, and nobody
 * finds out until the second one reaches the rack.
 *
 * ── Set aside, not consumed ──────────────────────────────────────
 * An earmark moves nothing on the lot. The yarn is still there and
 * leaves when a warping batch draws it — this only says who is
 * counting on it, so a second order can see what is genuinely free.
 *
 * ── Partial is normal ────────────────────────────────────────────
 * A long-lead yarn gets earmarked as it arrives, so 250 kg against a
 * 400 kg requirement is an ordinary state. The panel shows the gap
 * rather than treating it as an error.
 */

const kg = (n: number) => `${(Math.round(n * 1000) / 1000).toLocaleString("en-IN")} kg`;

const materialIdOf = (m: RawMaterialRequirement) =>
  m.rawMaterial ??
  (typeof m.material === "object" ? m.material?._id : m.material) ??
  m.id ??
  "";

const requiredOf = (m: RawMaterialRequirement) => m.requiredWeight ?? m.required ?? 0;

const assignedOf = (m: RawMaterialRequirement) =>
  (m.lots ?? []).reduce((t, l) => t + (Number(l.quantity) || 0), 0);

/** How much of a requirement the earmarks cover, as a chip. */
export function LotCoverage({ material }: { material: RawMaterialRequirement }) {
  const required = requiredOf(material);
  const assigned = assignedOf(material);

  if (assigned <= 0) return <StatusChip tone="neutral">No lots set aside</StatusChip>;
  // Rounded before comparing: 249.9999 against 250 is a floating-point
  // artefact, not an uncovered kilo, and reporting it as a gap would
  // make full coverage unreachable.
  if (Math.round(assigned * 1000) >= Math.round(required * 1000)) {
    return <StatusChip tone="success">Fully set aside</StatusChip>;
  }
  return (
    <StatusChip tone="warning">
      {kg(assigned)} of {kg(required)}
    </StatusChip>
  );
}

type Row = { yarnLot: string; quantity: string };

/** The picker for one material. */
function AssignDialog({
  orderId,
  material,
  onClose,
}: {
  orderId: string;
  material: RawMaterialRequirement;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const materialId = materialIdOf(material);

  const { data, isLoading, error } = useQuery({
    queryKey: ["order", orderId, "assignable-lots", materialId],
    queryFn: () => orderService.assignableLots(orderId, materialId),
    enabled: !!materialId,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [seeded, setSeeded] = useState(false);

  // Seeded once, from what the order already holds. Re-seeding on every
  // render of the query would throw away edits the moment react-query
  // refetched in the background.
  useEffect(() => {
    if (seeded || !data) return;
    setRows(
      data.current.length
        ? data.current.map((l) => ({ yarnLot: l.yarnLot, quantity: String(l.quantity) }))
        : [{ yarnLot: "", quantity: "" }]
    );
    setSeeded(true);
  }, [data, seeded]);

  const save = useMutation({
    mutationFn: () =>
      orderService.assignLots(orderId, [
        {
          rawMaterial: materialId,
          lots: rows
            .filter((r) => r.yarnLot && Number(r.quantity) > 0)
            .map((r) => ({ yarnLot: r.yarnLot, quantity: Number(r.quantity) })),
        },
      ]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      toast.show("Dye lots assigned.", "success");
      onClose();
    },
    onError: (e) =>
      toast.show(
        e instanceof ApiError ? e.message : "Could not assign the lots.",
        "error"
      ),
  });

  const required = requiredOf(material);
  const total = rows.reduce((t, r) => t + (Number(r.quantity) || 0), 0);
  const overRequirement = total > required && required > 0;

  /**
   * What a row may take: the lot's free balance, plus whatever this
   * order already holds of it.
   *
   * The server excludes this order's own earmarks from `allocated`, so
   * `free` is already the right ceiling — the addition here would
   * double-count. Kept as one named function so the rule lives in one
   * place rather than being re-derived at each use.
   */
  const ceilingFor = (lot: AssignableLot | undefined) => (lot ? lot.free : 0);

  const lotById = useMemo(
    () => new Map((data?.lots ?? []).map((l) => [l.yarnLot, l])),
    [data]
  );

  const chosen = new Set(rows.map((r) => r.yarnLot).filter(Boolean));

  return (
    <Modal open onClose={onClose} title={`Dye lots — ${material.name ?? "material"}`}>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <p className="text-status-danger text-sm">
          {error instanceof ApiError ? error.message : "Could not load the lots."}
        </p>
      ) : !data?.lots.length ? (
        <div className="space-y-3">
          <p className="text-ink-600 text-sm">
            No open lot of this material has anything free. Either none has been
            received with a lot number, or every kilo is already promised to
            another order.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-ink-600 text-sm">
            This order needs <strong>{kg(required)}</strong>. Setting a lot aside does
            not take it off the rack — it stops other orders planning against the
            same bag, and the warping batch is then measured against your choice.
          </p>

          <div className="space-y-2">
            {rows.map((r, i) => {
              const lot = lotById.get(r.yarnLot);
              const ceiling = ceilingFor(lot);
              const over = lot != null && Number(r.quantity) > ceiling;
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Select
                      aria-label={`Lot ${i + 1}`}
                      value={r.yarnLot}
                      onChange={(e) =>
                        setRows(rows.map((x, j) => (j === i ? { ...x, yarnLot: e.target.value } : x)))
                      }
                    >
                      <option value="">Choose a lot…</option>
                      {data.lots
                        // A lot already on another row would be rejected
                        // by the server as a duplicate. Hiding it here
                        // means the refusal never has to happen.
                        .filter((l) => l.yarnLot === r.yarnLot || !chosen.has(l.yarnLot))
                        .map((l) => (
                          <option key={l.yarnLot} value={l.yarnLot}>
                            {l.lotNo}
                            {l.shade ? ` · ${l.shade}` : ""} — {kg(l.free)} free
                            {l.allocated > 0 ? ` (${kg(l.allocated)} promised elsewhere)` : ""}
                          </option>
                        ))}
                    </Select>
                    {lot && (
                      <p className="mt-1 text-xs text-ink-500">
                        {kg(lot.balance)} on the rack
                        {lot.ageDays != null && ` · ${lot.ageDays}d old`}
                      </p>
                    )}
                  </div>
                  <div className="w-32">
                    <Input
                      aria-label={`Quantity ${i + 1}`}
                      type="number"
                      min={0}
                      step="0.001"
                      placeholder="kg"
                      value={r.quantity}
                      onChange={(e) =>
                        setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))
                      }
                    />
                    {over && (
                      <p className="mt-1 text-xs text-status-danger">
                        only {kg(ceiling)} free
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`Remove lot ${i + 1}`}
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          <Button
            variant="secondary"
            onClick={() => setRows([...rows, { yarnLot: "", quantity: "" }])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add a lot
          </Button>

          <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className={overRequirement ? "text-status-danger" : "text-ink-600"}>
              {kg(total)} of {kg(required)} set aside
              {/* Partial is fine and says so, rather than reading as an
                  unfinished form somebody has to complete now. */}
              {!overRequirement && total < required && (
                <span className="ml-1 text-ink-400">
                  — {kg(required - total)} still open, which is fine
                </span>
              )}
              {overRequirement && <span className="ml-1">— more than this order needs</span>}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || overRequirement}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OrderLotAssign({ order }: { order: OrderDetail }) {
  const [editing, setEditing] = useState<RawMaterialRequirement | null>(null);

  // Only a live order can promise yarn. An Open one has not drawn stock
  // yet and a Completed one has already used what it drew, so an
  // earmark on either would hold bags for a claim that does not exist —
  // which is exactly what the server refuses, said here first.
  const live = order.status === "Approved" || order.status === "InProgress";
  const materials = order.rawMaterialRequired ?? [];

  if (!materials.length) return null;

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2 px-5 pt-5">
        <Layers className="h-4 w-4 text-ink-500" />
        <h3 className="font-semibold">Dye lots set aside</h3>
      </div>
      <p className="px-5 pt-1 text-sm text-ink-500">
        Which bags this order's yarn comes out of. Nothing leaves the rack until a
        warping batch draws it — this stops another order planning against the same
        lot, and the batch picker is measured against it.
      </p>

      <div className="mt-3 divide-y divide-line">
        {materials.map((m) => {
          const id = materialIdOf(m);
          const lots: OrderLotEarmark[] = m.lots ?? [];
          return (
            <div key={id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-[9rem] flex-1">
                <div className="font-medium">{m.name ?? "—"}</div>
                <div className="text-xs text-ink-500">needs {kg(requiredOf(m))}</div>
              </div>

              <div className="flex-[2] text-sm">
                {lots.length === 0 ? (
                  <span className="text-ink-400">Nothing set aside</span>
                ) : (
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {lots.map((l) => (
                      <span key={l.yarnLot} className="tabular-nums">
                        <span className="font-medium">{l.lotNo}</span>
                        <span className="text-ink-500"> {kg(l.quantity)}</span>
                      </span>
                    ))}
                  </span>
                )}
              </div>

              <LotCoverage material={m} />

              <Button
                variant="secondary"
                disabled={!live}
                title={
                  live
                    ? undefined
                    : `Lots can only be set aside while the order is approved or in progress — this one is ${order.status}`
                }
                onClick={() => setEditing(m)}
              >
                {lots.length ? "Change" : "Assign"}
              </Button>
            </div>
          );
        })}
      </div>

      {editing && (
        <AssignDialog
          orderId={order._id}
          material={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  );
}
