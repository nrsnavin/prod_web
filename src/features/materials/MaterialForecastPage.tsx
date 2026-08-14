import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Sparkles, AlertTriangle, TrendingDown, ShoppingCart, Info,
  CalendarClock, Radar, Truck,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { useReplenishmentForecast } from "./hooks";
import { ForecastLine, ForecastSupplierGroup, LeadTimeSource } from "./types";
import { ReorderExplainer } from "./ReorderExplainer";

// How long an order should last once it arrives. Replaces the old
// "horizon" tabs: the reorder point is set by the supplier's lead time
// now, so a look-ahead window no longer decides anything — how much to
// buy does.
const COVER_OPTIONS = [15, 30, 45, 60];
const inr = (n: number) => n.toLocaleString("en-IN");
const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

// Where a lead time came from, said in the fewest words that still
// distinguish a measured figure from a typed one. A buyer who cannot
// tell them apart cannot know how far to trust the date beside them.
const LEAD_SOURCE: Record<LeadTimeSource, { label: string; measured: boolean }> = {
  "observed-material": { label: "measured", measured: true },
  "observed-supplier": { label: "measured", measured: true },
  material: { label: "set", measured: false },
  supplier: { label: "set", measured: false },
  none: { label: "not set", measured: false },
};

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </Card>
  );
}

function LeadTimeNote({ l }: { l: ForecastLine }) {
  const src = LEAD_SOURCE[l.leadTimeSource];
  const obs = l.leadTimeObserved;

  return (
    <span
      className="inline-flex items-center gap-1"
      // The whole learning story in a tooltip, because it is the sort of
      // thing a buyer wants once and then never again.
      title={
        obs
          ? `${obs.deliveries} deliveries measured: median ${obs.median}d, ` +
            `spread ±${obs.sd}d, fastest ${obs.fastest}d, slowest ${obs.slowest}d ` +
            `(${obs.confidence} confidence)`
          : "No delivery history yet — this figure was typed in."
      }
    >
      <Truck className="h-3 w-3" />
      {l.leadTimeDays}d {src.label}
      {src.measured && obs && (
        <span className="text-ink-400">· {obs.deliveries} deliveries</span>
      )}
    </span>
  );
}

function LineRow({ l, onExplain }: { l: ForecastLine; onExplain: (l: ForecastLine) => void }) {
  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          l.alreadyLate
            ? "bg-status-danger ring-2 ring-status-danger/30"
            : l.severity === "critical"
              ? "bg-status-danger"
              : "bg-status-warning"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {l.name} <span className="text-xs font-normal text-ink-400">· {l.category}</span>
          {/*
            An order placed today can no longer beat the stockout. A
            different and more urgent state than "below the reorder
            point", and the one that stops a loom.
          */}
          {l.alreadyLate && (
            <span className="ml-2 rounded bg-status-dangerBg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-danger">
              Past order-by
            </span>
          )}
        </p>

        {/* The date this whole page exists to produce. */}
        {l.orderByDate && (
          <p className={cn(
            "mt-0.5 flex items-center gap-1 text-xs font-medium",
            l.alreadyLate ? "text-status-danger" : "text-ink-700"
          )}>
            <CalendarClock className="h-3.5 w-3.5" />
            {l.alreadyLate
              ? `Order-by was ${shortDate(l.orderByDate)}`
              : `Order by ${shortDate(l.orderByDate)}`}
            <span className="font-normal text-ink-400">
              · runs out {l.projectedStockoutDate ? shortDate(l.projectedStockoutDate) : "—"}
            </span>
          </p>
        )}

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-400">
          <span>
            net {inr(l.netStock)} {l.unit}
            <span className="text-ink-300">
              {" "}({inr(l.onHand)} here
              {l.onOrder > 0 && ` +${inr(l.onOrder)} coming`}
              {l.committed > 0 && ` −${inr(l.committed)} spoken for`})
            </span>
          </span>
          <span>· uses {l.dailyDemand}/day</span>
          <span>· <LeadTimeNote l={l} /></span>
          {l.demandPattern === "intermittent" && (
            <span
              className="inline-flex items-center gap-1 text-status-warning"
              title="Drawn only a few days a month, so its safety stock is dominated by the days with no draw at all. Treat the quantity as a ceiling."
            >
              · <Radar className="h-3 w-3" /> lumpy demand
            </span>
          )}
          {/*
            Somebody typed a lead time the deliveries contradict. Not
            corrected automatically — surfaced, so somebody decides.
          */}
          {l.leadTimeDisagrees && l.leadTimeObserved && (
            <span className="text-status-warning">
              · set to {l.leadTimeDays}d, deliveries say {l.leadTimeObserved.median}d
            </span>
          )}
        </p>

        {/*
          Every term, so the number can be argued with rather than
          obeyed — and a way through to the whole working, because a
          buyer who cannot see how a figure was reached will order what
          they were going to order anyway.
        */}
        <button
          type="button"
          onClick={() => onExplain(l)}
          className="mt-0.5 text-left text-[11px] text-ink-300 underline decoration-dotted underline-offset-2 hover:text-ink-600"
        >
          reorder point {inr(l.reorderPoint)} = {inr(l.demandDuringLead)} used while waiting
          + {inr(l.safetyStock)} safety
          {l.safetyFromLeadTime > l.safetyFromDemand && l.safetyFromLeadTime > 0 && " (mostly for delivery timing)"}
          {" · show working"}
        </button>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-xs text-ink-400">
          order <span className="font-semibold text-ink-900">{inr(l.suggestedQty)} {l.unit}</span>
        </p>
        {l.suggestedQty !== l.rawSuggestedQty && (
          <p className="text-[11px] text-ink-300" title="Rounded up to the supplier's pack size or minimum order.">
            {inr(l.rawSuggestedQty)} → pack
          </p>
        )}
        <p className="text-xs tabular-nums text-ink-600">₹{inr(l.estimatedCost)}</p>
      </div>
    </li>
  );
}

function SupplierCard({
  group,
  onExplain,
}: {
  group: ForecastSupplierGroup;
  onExplain: (l: ForecastLine) => void;
}) {
  const navigate = useNavigate();
  const draftPo = () => {
    navigate("/purchase-orders/new", {
      state: {
        prefill: {
          supplier: group.supplier._id,
          supplierName: group.supplier.name,
          items: group.lines.map((l) => ({ rawMaterial: l._id, quantity: l.suggestedQty, price: l.price })),
        },
      },
    });
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{group.supplier.name}</h3>
          <p className="text-xs text-ink-400">{group.lines.length} material{group.lines.length > 1 ? "s" : ""} · est. ₹{inr(group.estimatedCost)}</p>
        </div>
        <Button size="sm" onClick={draftPo}>
          <ShoppingCart className="h-4 w-4" /> Draft PO
        </Button>
      </div>
      <ul className="mt-1 divide-y divide-ink-100">
        {group.lines.map((l) => <LineRow key={l._id} l={l} onExplain={onExplain} />)}
      </ul>
    </Card>
  );
}

export function MaterialForecastPage() {
  // Cover, not horizon. The reorder point comes from the supplier's
  // lead time now, so a look-ahead window decides nothing; what a
  // buyer actually chooses is how long an order should last.
  const [coverDays, setCoverDays] = useState(30);
  // Which line's working is open. The explainer is the answer to "why
  // that much?", and a buyer who cannot get an answer will order what
  // they were going to order anyway.
  const [explaining, setExplaining] = useState<ForecastLine | null>(null);
  const { data, isLoading } = useReplenishmentForecast(coverDays);

  return (
    <>
      <Link to="/materials" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Raw materials
      </Link>
      <PageHeader
        title="Replenishment forecast"
        subtitle="Reorder points from what you actually use and how long each supplier actually takes. Nothing is ordered automatically."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-500">An order should last</span>
        <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
          {COVER_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setCoverDays(d)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                coverDays === d ? "bg-surface text-ink-900 shadow-sm" : "text-ink-600"
              )}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/*
        Lead time is what the whole model rests on and it defaults to
        zero. A mill that has set none would otherwise see an empty page
        — which reads exactly like "nothing needs ordering".
      */}
      {data?.warnings?.map((w) => (
        <Card key={w} className="mb-3 flex items-start gap-2 border-l-4 border-status-warning p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <span>{w}</span>
        </Card>
      ))}

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : data && data.totals.flagged > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="To reorder" value={data.totals.flagged} tone="text-status-warning" />
            {/*
              The headline number. Not "critical" — past the point where
              ordering today still helps, which is a different and much
              more actionable thing.
            */}
            <StatTile
              label="Past order-by date"
              value={data.totals.late}
              tone={data.totals.late > 0 ? "text-status-danger" : undefined}
            />
            <StatTile label="Suppliers" value={data.totals.suppliers} />
            <StatTile label="Est. spend" value={`₹${inr(data.totals.estimatedCost)}`} />
          </div>

          {data.aiSummary && (
            <Card className="mb-4 border-l-4 border-brand-500 p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
                <Sparkles className="h-3.5 w-3.5" /> AI procurement summary
              </p>
              <p className="whitespace-pre-wrap text-sm text-ink-700">{data.aiSummary}</p>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {data.bySupplier.map((g) => (
              <SupplierCard key={g.supplier._id} group={g} onExplain={setExplaining} />
            ))}
          </div>

          {data.skippedNoSupplier > 0 && (
            <Card className="mt-4 flex items-start gap-2 border-l-4 border-status-warning p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
              <span>{data.skippedNoSupplier} material{data.skippedNoSupplier > 1 ? "s" : ""} need reordering but have no default supplier set — assign one to include them.</span>
            </Card>
          )}

          <div className="mt-4 flex items-start gap-2 text-xs text-ink-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Reorder point = what you use while waiting for delivery, plus safety stock for
              the days demand or the supplier run over. Lead times marked <em>measured</em> come
              from your own goods receipts and sharpen with every delivery; the rest were typed
              in. Nothing is ordered automatically — "Draft PO" pre-fills one for your approval.
            </span>
          </div>
          <ReorderExplainer
            line={explaining}
            open={!!explaining}
            onClose={() => setExplaining(null)}
          />
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<TrendingDown className="h-6 w-6" />}
            title="No replenishment needed"
            description="Every material is above its reorder point, with enough cover to outlast its supplier's delivery time."
          />
        </Card>
      )}
    </>
  );
}
