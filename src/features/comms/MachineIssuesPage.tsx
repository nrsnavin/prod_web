import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { issueService, MachineIssue } from "./api";

const STATUSES = ["open", "acknowledged", "in_progress", "resolved", "dismissed"];
const statusTone: Record<string, ChipTone> = {
  open: "danger",
  acknowledged: "warning",
  in_progress: "info",
  resolved: "success",
  dismissed: "neutral",
};

function UpdateModal({ issue, onClose }: { issue: MachineIssue; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState(issue.status);
  const [notes, setNotes] = useState(issue.resolutionNotes ?? "");
  const update = useMutation({
    mutationFn: () => issueService.setStatus(issue._id, status, notes || undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["machine-issues"] }),
  });

  return (
    <Modal open onClose={onClose} title={`Issue — ${issue.machine?.ID ?? "machine"}`} width="max-w-md">
      <p className="text-sm text-ink-600 rounded-xl bg-ink-100/60 p-3">
        {issue.description ?? issue.title ?? ""}
      </p>
      <div className="mt-3 space-y-3">
        <Select
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <Input
          label="Resolution notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was done"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          loading={update.isPending}
          onClick={() =>
            update.mutate(undefined, {
              onSuccess: () => {
                toast("Issue updated", "success");
                onClose();
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
            })
          }
        >
          Update issue
        </Button>
      </div>
    </Modal>
  );
}

export function MachineIssuesPage() {
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<MachineIssue | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["machine-issues", status],
    queryFn: () => issueService.list(status),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader title="Machine issues" subtitle="Problems reported by operators from the floor." />

      <div className="mb-4">
        <FilterChips
          options={[{ value: "all", label: "All" }, ...STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench className="h-12 w-12" />}
            title="No machine issues"
            description="Operator-reported problems appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((i) => (
            <Card key={i._id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 rounded-lg bg-ink-100 grid place-items-center text-ink-600 shrink-0">
                  <Wrench className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {i.machine?.ID ?? "Machine"}
                    {i.severity && (
                      <StatusChip
                        tone={i.severity === "high" ? "danger" : i.severity === "medium" ? "warning" : "info"}
                        className="ml-2"
                      >
                        {i.severity}
                      </StatusChip>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">{i.description ?? i.title ?? ""}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    {i.employee?.name && `Reported by ${i.employee.name}`}
                    {i.createdAt && ` · ${new Date(i.createdAt).toLocaleDateString()}`}
                  </p>
                  {i.resolutionNotes && (
                    <p className="mt-2 rounded-lg bg-status-successBg px-3 py-2 text-sm">
                      {i.resolutionNotes}
                    </p>
                  )}
                </div>
                <StatusChip tone={statusTone[i.status] ?? "neutral"}>
                  {i.status.replace("_", " ")}
                </StatusChip>
                {i.status !== "resolved" && i.status !== "dismissed" && (
                  <Button size="sm" variant="secondary" onClick={() => setEditing(i)}>
                    Update
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <UpdateModal issue={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
