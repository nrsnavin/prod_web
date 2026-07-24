import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, CalendarOff, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { useEmployees } from "@/features/employees/hooks";
import { leaveService, LeaveCreateInput } from "./api";

export function LeavePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  // Pending approve/reject decision awaiting confirmation.
  const [decision, setDecision] = useState<{ id: string; name: string; action: "approve" | "reject" } | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leave", "pending"],
    queryFn: leaveService.pending,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leave"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => leaveService.approve(id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => leaveService.reject(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle="Pending requests from the employee app. Approved leave feeds attendance."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New leave
          </Button>
        }
      />

      <NewLeaveModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarOff className="h-12 w-12" />}
            title="No pending leave requests"
            description="New requests from workers appear here for approval."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((l) => {
            const id = l._id ?? l.id ?? "";
            return (
              <Card key={id} className="p-4 flex flex-wrap items-center gap-4">
                <span className="h-10 w-10 rounded-full bg-brand-100 text-brand-600 grid place-items-center font-bold uppercase">
                  {l.employee?.name?.charAt(0) ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.employee?.name ?? "—"}</p>
                  <p className="text-xs text-ink-400 capitalize">
                    {l.employee?.department ?? ""}
                    {l.type && ` · ${l.type}`}
                  </p>
                  {l.reason && <p className="mt-1 text-sm text-ink-600">{l.reason}</p>}
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">
                    {l.date ? new Date(l.date).toLocaleDateString() : "—"}
                    {l.toDate && ` → ${new Date(l.toDate).toLocaleDateString()}`}
                  </p>
                  {l.createdAt && (
                    <p className="text-xs text-ink-400">
                      requested {new Date(l.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => setDecision({ id, name: l.employee?.name ?? "this worker", action: "approve" })}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDecision({ id, name: l.employee?.name ?? "this worker", action: "reject" })}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </span>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={decision !== null}
        title={decision?.action === "reject" ? "Reject leave?" : "Approve leave?"}
        message={
          decision?.action === "reject"
            ? `Reject the leave request from ${decision?.name}? They'll be notified it was declined.`
            : `Approve the leave request from ${decision?.name}? This marks the day(s) as leave in their attendance.`
        }
        confirmLabel={decision?.action === "reject" ? "Reject" : "Approve"}
        danger={decision?.action === "reject"}
        loading={approve.isPending || reject.isPending}
        onCancel={() => setDecision(null)}
        onConfirm={() => {
          if (!decision) return;
          const mut = decision.action === "approve" ? approve : reject;
          mut.mutate(decision.id, {
            onSuccess: () => {
              toast(decision.action === "approve" ? "Leave approved" : "Leave rejected", "success");
              setDecision(null);
            },
            onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
          });
        }}
      />
    </>
  );
}

// Admin raises a leave request on an employee's behalf, optionally
// approving it in the same step (which syncs their attendance).
export function NewLeaveModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const employees = useEmployees("all");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<LeaveCreateInput["shift"]>("BOTH");
  const [leaveType, setLeaveType] = useState<LeaveCreateInput["leaveType"]>("casual");
  const [reason, setReason] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);

  const create = useMutation({
    mutationFn: (body: LeaveCreateInput) => leaveService.create(body),
  });

  const reset = () => {
    setEmployeeId("");
    setDate(new Date().toISOString().slice(0, 10));
    setShift("BOTH");
    setLeaveType("casual");
    setReason("");
    setAutoApprove(true);
  };

  const submit = () => {
    if (!employeeId) { toast("Select an employee", "error"); return; }
    if (!date) { toast("Pick a date", "error"); return; }
    if (reason.trim().length < 3) { toast("Give a reason (min 3 chars)", "error"); return; }
    create.mutate(
      { employeeId, date, shift, leaveType, reason: reason.trim(), autoApprove },
      {
        onSuccess: () => {
          toast(autoApprove ? "Leave created & approved" : "Leave request created", "success");
          onCreated();
          reset();
          onClose();
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to create leave", "error"),
      }
    );
  };

  return (
    <FormScreen open={open} onClose={onClose} title="New leave request" width="max-w-md">
      <div className="space-y-4">
        <Combobox
          label="Employee *"
          placeholder={employees.isLoading ? "Loading…" : "Select employee"}
          options={(employees.data ?? []).map((e) => ({ value: e._id, label: e.name }))}
          value={employeeId}
          onChange={setEmployeeId}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Select
            label="Shift *"
            options={[
              { value: "BOTH", label: "Full day (both)" },
              { value: "DAY", label: "Day" },
              { value: "NIGHT", label: "Night" },
            ]}
            value={shift}
            onChange={(e) => setShift(e.target.value as LeaveCreateInput["shift"])}
          />
        </div>
        <Select
          label="Leave type *"
          options={[
            { value: "casual", label: "Casual" },
            { value: "sick", label: "Sick" },
            { value: "unpaid", label: "Unpaid" },
          ]}
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as LeaveCreateInput["leaveType"])}
        />
        <Input
          label="Reason *"
          placeholder="e.g. Family function"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink-600 select-none">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
          />
          Approve immediately (updates attendance)
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={create.isPending} onClick={submit}>
            {autoApprove ? "Create & approve" : "Create request"}
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
