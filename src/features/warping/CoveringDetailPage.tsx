import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, XCircle, Tags, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useCovering, useCoveringMutations } from "./hooks";
import { ProgrammeChip, ElasticLines } from "./programmeShared";
import { CoveringLabels } from "./CoveringLabels";
import { CoveringProgrammeSheet } from "./CoveringProgrammeSheet";

export function CoveringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: covering, isLoading, isError, error } = useCovering(id);
  const { start, complete, cancel } = useCoveringMutations();
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !covering) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Covering not found"}
      </p>
    );
  }

  const onError = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : "Action failed", "error");

  return (
    <>
      <Link to="/covering" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900 mb-2">
        <ArrowLeft className="h-4 w-4" /> Covering
      </Link>
      <PageHeader
        title={`Covering — J-${covering.job?.jobOrderNo ?? ""}`}
        subtitle={covering.job?.customer?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              <Printer className="h-4 w-4" /> Programme
            </Button>
            <Button variant="secondary" onClick={() => setLabelsOpen(true)}>
              <Tags className="h-4 w-4" /> Labels
            </Button>
            {covering.status === "open" && (
              <Button
                loading={start.isPending}
                onClick={() =>
                  start.mutate(covering._id, {
                    onSuccess: () => toast("Covering started", "success"),
                    onError,
                  })
                }
              >
                <Play className="h-4 w-4" /> Start
              </Button>
            )}
            {covering.status === "in_progress" && (
              <Button
                loading={complete.isPending}
                onClick={() =>
                  complete.mutate(
                    { id: covering._id },
                    { onSuccess: () => toast("Covering completed", "success"), onError }
                  )
                }
              >
                <CheckCircle2 className="h-4 w-4" /> Complete
              </Button>
            )}
            {(covering.status === "open" || covering.status === "in_progress") && (
              <Button
                variant="danger"
                loading={cancel.isPending}
                onClick={() =>
                  cancel.mutate(
                    { id: covering._id },
                    { onSuccess: () => toast("Covering cancelled", "success"), onError }
                  )
                }
              >
                <XCircle className="h-4 w-4" /> Cancel
              </Button>
            )}
          </>
        }
      />

      <Card className="p-6">
        <div className="mb-4">
          <ProgrammeChip status={covering.status} />
        </div>
        <DescriptionList
          columns={3}
          items={[
            {
              label: "Job",
              value: covering.job ? (
                <Link to={`/jobs/${covering.job._id}`} className="text-brand-600 hover:underline">
                  J-{covering.job.jobOrderNo}
                </Link>
              ) : undefined,
            },
            { label: "Opened", value: covering.date ? new Date(covering.date).toLocaleDateString() : undefined },
            {
              label: "Completed",
              value: covering.completedDate
                ? new Date(covering.completedDate).toLocaleDateString()
                : undefined,
            },
            { label: "Remarks", value: covering.remarks },
          ]}
        />
      </Card>

      <Card className="mt-4 p-5 max-w-xl">
        <h3 className="font-semibold">Elastics planned</h3>
        <div className="mt-2">
          <ElasticLines lines={covering.elasticPlanned} />
        </div>
      </Card>

      <CoveringLabels open={labelsOpen} onClose={() => setLabelsOpen(false)} covering={covering} />
      <CoveringProgrammeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} covering={covering} />
    </>
  );
}
