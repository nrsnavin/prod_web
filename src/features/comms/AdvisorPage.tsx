import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useDashboardKpis, usePendingShiftCount } from "@/features/dashboard/hooks";
import { advisorService } from "./api";

// Builds "cards" from live dashboard signals and asks the backend's LLM
// briefing endpoint to summarize what deserves attention.
export function AdvisorPage() {
  const { toast } = useToast();
  const kpis = useDashboardKpis();
  const pending = usePendingShiftCount();

  const briefing = useMutation({
    mutationFn: () => {
      const d = kpis.data;
      const cards: unknown[] = [];
      if (d) {
        if (d.lowStock.count > 0)
          cards.push({ type: "low_stock", count: d.lowStock.count, items: d.lowStock.items });
        if (d.pendingLeaves > 0) cards.push({ type: "pending_leaves", count: d.pendingLeaves });
        cards.push({ type: "open_jobs", count: d.openJobs });
        cards.push({ type: "attendance", ...d.attendanceToday });
      }
      if ((pending.data ?? 0) > 0)
        cards.push({ type: "pending_shift_verifications", count: pending.data });
      return advisorService.briefing(cards);
    },
  });

  return (
    <>
      <PageHeader
        title="AI advisor"
        subtitle="One-tap operations briefing generated from today's floor signals."
      />

      <Card className="p-8 max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-xl bg-brand-50 grid place-items-center text-brand-600">
            <Sparkles className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold">Morning briefing</h3>
            <p className="text-sm text-ink-400">
              Sends today's KPI signals (low stock, pending leaves, open jobs, attendance,
              shift verifications) to the advisor for a prioritized summary.
            </p>
          </div>
          <Button
            loading={briefing.isPending || kpis.isLoading}
            onClick={() =>
              briefing.mutate(undefined, {
                onError: (e) =>
                  toast(
                    e instanceof ApiError
                      ? e.message
                      : "Briefing failed — is the API key configured on the server?",
                    "error"
                  ),
              })
            }
          >
            Generate
          </Button>
        </div>

        {briefing.data?.summary && (
          <div className="mt-6 rounded-xl bg-canvas p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {briefing.data.summary}
          </div>
        )}
        {briefing.isError && (
          <p className="mt-6 text-sm text-status-danger">
            {(briefing.error as Error).message}
          </p>
        )}
      </Card>
    </>
  );
}
