import { Link } from "react-router-dom";
import { PackageX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardKpis } from "../api";

export function LowStockCard({
  data,
  loading,
}: {
  data?: DashboardKpis["lowStock"];
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">
          Low stock materials{" "}
          {data && data.count > 0 && (
            <StatusChip tone="danger" className="ml-1 align-middle">
              {data.count}
            </StatusChip>
          )}
        </h3>
        <Link to="/materials" className="text-sm font-medium text-brand-600 hover:underline">
          View all
        </Link>
      </div>

      {loading || !data ? (
        <div className="mt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<PackageX className="h-10 w-10" />}
          title="All materials above minimum"
          description="No raw material is at or below its minimum stock level."
        />
      ) : (
        <ul className="mt-3 divide-y divide-ink-100">
          {data.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-ink-400 capitalize">{item.category}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-status-danger">
                  {item.stock}
                </p>
                <p className="text-xs text-ink-400 tabular-nums">min {item.minStock}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
