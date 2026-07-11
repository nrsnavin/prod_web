import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Fingerprint, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { auditService, AuditEntry } from "./api";

const entityMeta: Record<AuditEntry["entityType"], { label: string; path: (e: AuditEntry) => string | null }> = {
  Order:           { label: "Order",  path: (e) => `/orders/${e.entityId}` },
  JobOrder:        { label: "Job",    path: (e) => `/jobs/${e.entityId}` },
  PurchaseOrder:   { label: "PO",     path: (e) => `/purchase-orders/${e.entityId}` },
  DeliveryChallan: { label: "DC",     path: (e) => `/delivery-challans/${e.entityId}` },
};

// Destructive/corrective actions surface in red so reviews scan fast.
const dangerCodes = /DELETED|CANCELLED/;
const editCodes   = /UPDATED|EDITED/;

function tone(code: string): "danger" | "warning" | "neutral" {
  if (dangerCodes.test(code)) return "danger";
  if (editCodes.test(code)) return "warning";
  return "neutral";
}

function fmt(at: string): string {
  return new Date(at).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function AuditPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit-recent"],
    queryFn: () => auditService.recent(100),
    staleTime: 30_000,
  });

  const entries = data?.entries ?? [];

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Every recorded action across orders, jobs, purchase orders and delivery challans — who did what, when, and why."
        actions={
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Fingerprint className="h-6 w-6" />}
            title="No audit entries yet"
            description="Actions appear here as soon as they're recorded."
          />
        </Card>
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {entries.map((e) => {
            const meta = entityMeta[e.entityType];
            const href = meta?.path(e);
            return (
              <div key={`${e.entityId}-${e.shortId}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 tabular-nums text-xs text-ink-400">{fmt(e.at)}</span>
                <StatusChip tone={tone(e.code)}>{e.label || e.code}</StatusChip>
                <span className="min-w-0 flex-1 truncate">
                  {href ? (
                    <Link to={href} className="font-medium hover:text-brand-600">
                      {meta.label} {e.entityNo ?? ""}
                    </Link>
                  ) : (
                    <span className="font-medium">{meta?.label} {e.entityNo ?? ""}</span>
                  )}
                  {e.reason && <span className="ml-2 text-ink-500">— “{e.reason}”</span>}
                </span>
                <span className="shrink-0 text-xs text-ink-400">
                  {e.actor?.name || "System"}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink-300" title="Fingerprint">
                  {e.shortId}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      <p className="mt-3 text-xs text-ink-400">
        Entries are tamper-evident fingerprints stored on the documents themselves — this feed is read-only.
      </p>
    </>
  );
}

export default AuditPage;
