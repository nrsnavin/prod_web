import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Sparkles, AlertTriangle, TrendingDown, ShoppingCart, Info, Clock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { useReplenishmentForecast } from "./hooks";
import { ForecastLine, ForecastSupplierGroup } from "./types";

const HORIZONS = [7, 14, 30, 60];
const inr = (n: number) => n.toLocaleString("en-IN");

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-400">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", tone)}>{value}</p>
    </Card>
  );
}

function LineRow({ l }: { l: ForecastLine }) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span
        className={cn(
          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
          l.severity === "critical" ? "bg-status-danger" : "bg-status-warning"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {l.name} <span className="text-xs font-normal text-ink-400">· {l.category}</span>
        </p>
        <p className="text-xs text-ink-400">
          on-hand {inr(l.onHand)} · uses {l.runRatePerDay}/day
          {l.committedDemand > 0 && ` · committed ${inr(l.committedDemand)}`}
          {l.projectedStockoutDate && (
            <span className="text-status-danger">
              {" "}· <Clock className="inline h-3 w-3" /> stockout ~{new Date(l.projectedStockoutDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("tabular-nums", l.projectedStock < 0 ? "text-status-danger font-semibold" : "text-ink-600")}>
          proj {inr(l.projectedStock)}
        </p>
        <p className="text-xs text-ink-400">order <span className="font-semibold text-ink-900">{inr(l.suggestedQty)} {l.unit}</span></p>
      </div>
      <span className="w-20 shrink-0 text-right text-sm tabular-nums text-ink-600">₹{inr(l.estimatedCost)}</span>
    </li>
  );
}

function SupplierCard({ group }: { group: ForecastSupplierGroup }) {
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
        {group.lines.map((l) => <LineRow key={l._id} l={l} />)}
      </ul>
    </Card>
  );
}

export function MaterialForecastPage() {
  const [horizon, setHorizon] = useState(14);
  const { data, isLoading } = useReplenishmentForecast(horizon);

  return (
    <>
      <Link to="/materials" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Raw materials
      </Link>
      <PageHeader
        title="Replenishment forecast"
        subtitle="Projects stock from the order pipeline + recent consumption, and drafts POs before you run out."
      />

      <div className="mb-4 flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
        {HORIZONS.map((d) => (
          <button
            key={d}
            onClick={() => setHorizon(d)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              horizon === d ? "bg-surface text-ink-900 shadow-sm" : "text-ink-600"
            )}
          >
            {d}-day
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : data && data.totals.flagged > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Materials to reorder" value={data.totals.flagged} tone="text-status-warning" />
            <StatTile label="Critical (stockout)" value={data.totals.critical} tone={data.totals.critical > 0 ? "text-status-danger" : undefined} />
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
            {data.bySupplier.map((g) => <SupplierCard key={g.supplier._id} group={g} />)}
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
              Projected stock = on-hand − committed demand (Open orders) − run-rate × {horizon} days. Nothing is
              ordered automatically; "Draft PO" pre-fills a purchase order for your review and approval.
            </span>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<TrendingDown className="h-6 w-6" />}
            title="No replenishment needed"
            description={`No material is projected to drop below its safety stock within ${horizon} days.`}
          />
        </Card>
      )}
    </>
  );
}
