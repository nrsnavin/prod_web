import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { machineService } from "@/features/machines/api";
import { issueService, MachineIssue } from "./api";

const SEVERITIES = ["low", "medium", "high", "critical"];
const SERVICE_TYPES = ["Corrective", "Preventive", "Breakdown", "Inspection", "Other"];

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

  // Optional service log captured when the issue is resolved.
  const [logType, setLogType] = useState("Corrective");
  const [logDesc, setLogDesc] = useState("");
  const [technician, setTechnician] = useState("");
  const [cost, setCost] = useState("");
  const [nextService, setNextService] = useState("");

  const resolving = status === "resolved";

  const update = useMutation({
    mutationFn: async () => {
      await issueService.setStatus(issue._id, status, notes || undefined);
      // On resolution, also append a service log to the machine if the
      // engineer filled in the service details.
      if (resolving && logDesc.trim() && issue.machine?._id) {
        await machineService.addServiceLog(issue.machine._id, {
          type: logType as "Corrective" | "Preventive" | "Breakdown" | "Inspection" | "Other",
          description: logDesc.trim(),
          technician: technician.trim() || undefined,
          cost: cost ? Number(cost) : undefined,
          nextServiceDate: nextService || undefined,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-issues"] });
      qc.invalidateQueries({ queryKey: ["machines"] });
    },
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

        {resolving && (
          <div className="rounded-lg border border-ink-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Wrench className="h-4 w-4 text-ink-400" /> Service log (optional)
            </p>
            <div className="space-y-2">
              <Select
                label="Type"
                options={SERVICE_TYPES.map((t) => ({ value: t, label: t }))}
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
              />
              <Input label="Work done" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder="e.g. Replaced drive belt" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Technician" value={technician} onChange={(e) => setTechnician(e.target.value)} />
                <Input label="Cost (₹)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <Input label="Next service date" type="date" value={nextService} onChange={(e) => setNextService(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          loading={update.isPending}
          onClick={() =>
            update.mutate(undefined, {
              onSuccess: () => {
                toast(resolving && logDesc.trim() ? "Issue resolved & service logged" : "Issue updated", "success");
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

// ── Report a new issue (admin) ──────────────────────────────────
function ReportIssueModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [machineId, setMachineId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");

  const machines = useQuery({
    queryKey: ["machines", "all"],
    queryFn: () => machineService.list("all"),
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: () => issueService.create({ machineId, title: title.trim(), description: description.trim(), severity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-issues"] });
      qc.invalidateQueries({ queryKey: ["machine-anomalies"] });
    },
  });

  const valid = machineId && title.trim() && description.trim();

  return (
    <Modal open onClose={onClose} title="Report machine issue" width="max-w-md">
      <div className="space-y-3">
        <Combobox
          label="Machine *"
          placeholder="Select machine"
          options={(machines.data ?? []).map((m) => ({ value: m._id, label: `Machine ${m.ID}` }))}
          value={machineId}
          onChange={setMachineId}
        />
        <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Loom stops intermittently" />
        <Input label="Description *" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening" />
        <Select
          label="Severity"
          options={SEVERITIES.map((s) => ({ value: s, label: s }))}
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!valid}
          loading={create.isPending}
          onClick={() =>
            create.mutate(undefined, {
              onSuccess: () => {
                toast("Issue reported", "success");
                onClose();
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to report", "error"),
            })
          }
        >
          Report issue
        </Button>
      </div>
    </Modal>
  );
}

// ── Repeat-offender anomaly banner ──────────────────────────────
function AnomalyBanner() {
  const { data } = useQuery({
    queryKey: ["machine-anomalies"],
    queryFn: () => issueService.anomalies(30, 3),
    refetchInterval: 120_000,
  });
  const anomalies = data?.anomalies ?? [];
  if (anomalies.length === 0) return null;

  return (
    <Card className="mb-4 border-l-4 border-status-danger p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-status-danger">
        <AlertTriangle className="h-4 w-4" />
        Frequent breakdowns — {anomalies.length} machine{anomalies.length === 1 ? "" : "s"} with {data?.threshold}+ issues in {data?.windowDays} days
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {anomalies.map((a) => (
          <span
            key={a.machineId}
            className="inline-flex items-center gap-2 rounded-full border border-status-danger/30 bg-status-dangerBg px-3 py-1 text-sm"
          >
            <span className="font-medium">Machine {a.machineID ?? "—"}</span>
            <span className="tabular-nums text-status-danger">{a.count} issues</span>
            {a.openCount > 0 && <span className="text-xs text-ink-500">· {a.openCount} open</span>}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function MachineIssuesPage() {
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<MachineIssue | null>(null);
  const [reporting, setReporting] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["machine-issues", status],
    queryFn: () => issueService.list(status),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title="Machine issues"
        subtitle="Problems reported from the floor, and by admins."
        actions={
          <Button onClick={() => setReporting(true)}>
            <Plus className="h-4 w-4" /> Report issue
          </Button>
        }
      />

      <AnomalyBanner />

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
      {reporting && <ReportIssueModal onClose={() => setReporting(false)} />}
    </>
  );
}
