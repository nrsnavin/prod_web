import { SidePanel } from "@/components/ui/SidePanel";
import { cn } from "@/components/ui/cn";
import { ForecastLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  WHY THE SYSTEM ASKED FOR THIS MUCH
//
//  A buyer who cannot see how a number was reached will order what they
//  were going to order anyway, and the system becomes a screen people
//  click past. So every term of the reorder point is drawn to scale
//  against the stock actually on hand — the comparison the decision is
//  made on, in the one form nobody has to be talked through.
//
//  Drawn with CSS widths rather than a chart library: it is four
//  quantities on one axis, and a charting dependency for that would be
//  more code to keep working than the thing it draws.
// ══════════════════════════════════════════════════════════════════

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");
const day = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** One labelled bar on the shared scale. */
function Bar({
  label,
  value,
  max,
  className,
  note,
}: {
  label: string;
  value: number;
  max: number;
  className: string;
  note?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-ink-600">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-ink-900">{inr(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-sm bg-ink-100">
        <div className={cn("h-full rounded-sm", className)} style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="text-[11px] leading-snug text-ink-400">{note}</p>}
    </div>
  );
}

/** A step in the arithmetic, as a line somebody can check by hand. */
function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold tabular-nums text-ink-600">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="text-xs leading-relaxed text-ink-500">{children}</div>
      </div>
    </li>
  );
}

const num = (n: number) => (
  <span className="font-medium tabular-nums text-ink-900">{inr(n)}</span>
);

export function ReorderExplainer({
  line,
  open,
  onClose,
}: {
  line: ForecastLine | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!line) return null;

  const l = line;
  const measured = l.leadTimeSource.startsWith("observed");
  const obs = l.leadTimeObserved;

  // One scale for every bar, so their lengths can be compared by eye.
  // The target is the tallest thing on the chart by construction.
  const target = l.reorderPoint + l.dailyDemand * 30;
  const max = Math.max(target, l.netStock, l.reorderPoint, 1);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      width="max-w-lg"
      // A comfortable material is being inspected, not bought. Titling
      // it "Why buy 0?" would be nonsense on the one screen whose whole
      // job is to make the arithmetic legible.
      title={
        l.needsOrder
          ? `Why buy ${inr(l.suggestedQty)} ${l.unit}?`
          : `Why ${l.name} needs nothing`
      }
    >
      <div className="space-y-6">
        {/* ── The comparison the decision is made on ───────────── */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            Where you stand
          </h3>

          <Bar
            label="Net stock"
            value={l.netStock}
            max={max}
            className={l.netStock < l.reorderPoint ? "bg-status-danger" : "bg-status-success"}
            note={`${inr(l.onHand)} on the shelf${
              l.onOrder > 0 ? ` + ${inr(l.onOrder)} already ordered` : ""
            }${l.committed > 0 ? ` − ${inr(l.committed)} promised to open orders` : ""}`}
          />

          <Bar
            label="Reorder point"
            value={l.reorderPoint}
            max={max}
            className="bg-status-warning"
            note="Drop below this and an order placed today only just arrives in time."
          />

          <Bar
            label="Buy up to"
            value={target}
            max={max}
            className="bg-brand-500"
            note="The reorder point plus a month of running, so you are not back here next week."
          />

          <p className="rounded-md bg-ink-100 px-3 py-2 text-xs leading-relaxed text-ink-600">
            {l.netStock < l.reorderPoint ? (
              <>
                Net stock is {num(l.reorderPoint - l.netStock)} {l.unit} below the reorder
                point, so the gap to the target is {num(l.suggestedQty)} {l.unit}.
              </>
            ) : (
              <>Net stock is above the reorder point — nothing needs ordering.</>
            )}
          </p>
        </section>

        {/* ── How the reorder point was arrived at ─────────────── */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            How the reorder point is worked out
          </h3>
          <ol className="space-y-3">
            <Step n={1} title="What you use in a day">
              {num(l.dailyDemand)} {l.unit}/day, averaged over every day in the window —
              including the days nothing was drawn. From {l.drawsInWindow} issue
              {l.drawsInWindow === 1 ? "" : "s"}, counting both yarn drawn at order
              approval and yarn issued against a job.
              {l.demandPattern === "intermittent" && (
                <span className="mt-1 block text-status-warning">
                  Drawn only a few days a month, so most of the safety stock below is
                  covering the days with no draw at all. Treat the quantity as a ceiling.
                </span>
              )}
            </Step>

            <Step n={2} title="How long the yarn takes to come">
              {num(l.leadTimeDays)} days
              {measured ? (
                <>
                  {" "}— <strong className="text-ink-700">measured from your own deliveries</strong>
                  {obs && (
                    <>
                      : {obs.deliveries} goods receipts, median {obs.median}d, fastest{" "}
                      {obs.fastest}d, slowest {obs.slowest}d. Sharpens with every delivery.
                    </>
                  )}
                </>
              ) : l.leadTimeSource === "none" ? (
                <>
                  {" "}— nobody has set one and there are no deliveries to measure, so this
                  is the manual minimum stock only. No order-by date can be worked out.
                </>
              ) : (
                <>
                  {" "}— typed in on the {l.leadTimeSource}.
                  {obs && ` Your deliveries say ${obs.median}d across ${obs.deliveries} receipts.`}
                </>
              )}
            </Step>

            <Step n={3} title="Used while waiting">
              {num(l.dailyDemand)} × {l.leadTimeDays} days = {num(l.demandDuringLead)} {l.unit}.
              This much leaves the shelf between placing the order and the goods arriving.
            </Step>

            <Step n={4} title="Safety stock">
              {num(l.safetyStock)} {l.unit}, at a {l.serviceLevel}% service level — enough
              that you run out about {100 - l.serviceLevel} time
              {100 - l.serviceLevel === 1 ? "" : "s"} in 100 rather than half the time.
              {l.safetyFromLeadTime > l.safetyFromDemand ? (
                <span className="mt-1 block">
                  Most of it ({num(l.safetyFromLeadTime)}) is for the delivery date moving
                  around, not for demand. A more predictable supplier would free up stock
                  here.
                </span>
              ) : l.safetyFromDemand > 0 ? (
                <span className="mt-1 block">
                  Most of it ({num(l.safetyFromDemand)}) is for demand moving around rather
                  than the supplier.
                </span>
              ) : null}
            </Step>

            <Step n={5} title="Reorder point">
              {num(l.demandDuringLead)} + {num(l.safetyStock)} = {num(l.reorderPoint)} {l.unit}
              {l.reorderPoint === l.minStock && l.minStock > 0 && (
                <> — held up to your manual minimum of {num(l.minStock)}.</>
              )}
            </Step>
          </ol>
        </section>

        {/* ── The date ─────────────────────────────────────────── */}
        {l.orderByDate && (
          <section
            className={cn(
              "rounded-md border-l-4 p-3",
              l.alreadyLate
                ? "border-status-danger bg-status-dangerBg"
                : "border-brand-500 bg-ink-100"
            )}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {l.alreadyLate ? "This one is already late" : "The date that matters"}
            </h3>
            <p className="mt-1 text-sm leading-relaxed">
              At {inr(l.dailyDemand)} {l.unit}/day, net stock lasts until{" "}
              <strong>{day(l.projectedStockoutDate!)}</strong>. Subtract the{" "}
              {l.leadTimeDays}-day wait and an order has to leave by{" "}
              <strong className={l.alreadyLate ? "text-status-danger" : undefined}>
                {day(l.orderByDate)}
              </strong>
              .
              {l.alreadyLate && (
                <> That date has passed — an order placed today arrives after you run out.</>
              )}
            </p>
          </section>
        )}

        {/* ── What was actually bought ─────────────────────────── */}
        {l.needsOrder && l.suggestedQty !== l.rawSuggestedQty && (
          <p className="text-xs text-ink-400">
            The gap comes to {inr(l.rawSuggestedQty)} {l.unit}; rounded up to{" "}
            {inr(l.suggestedQty)} to match what this supplier sells — their pack size or
            minimum order.
          </p>
        )}

        <p className="border-t border-ink-100 pt-3 text-[11px] leading-relaxed text-ink-400">
          Nothing here is ordered automatically, and no figure comes from a model you
          cannot check — every number above is arithmetic on your own stock, issues and
          goods receipts.
        </p>
      </div>
    </SidePanel>
  );
}
