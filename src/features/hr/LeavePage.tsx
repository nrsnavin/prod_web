import { ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, CalendarOff, Plus, Undo2 } from "lucide-react";
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
import { leaveService, LeaveCreateInput, LeaveRow, LeaveWithdrawn } from "./api";
import { formatDate } from "@/core/format/date";

/** "12 Nov 2026" for a calendar date ("YYYY-MM-DD"), whatever zone the browser keeps. */
export function dayLabel(ymd?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? "");
  return m ? formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : "—";
}

const SHIFT_LABEL: Record<string, string> = { DAY: "Day shift", NIGHT: "Night shift", BOTH: "Full day" };

/** What kind of leave and for which shift: "Casual · Full day". */
export function leaveKind(l: LeaveRow): string {
  const type = l.leaveType ? l.leaveType.charAt(0).toUpperCase() + l.leaveType.slice(1) : "";
  return [type, l.shift ? SHIFT_LABEL[l.shift] ?? l.shift : ""].filter(Boolean).join(" · ");
}

/** The first day of this month, "YYYY-MM-DD": approved leave is listed from here on. */
function monthStart(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** What taking the approval back did, for the toast. */
export function withdrawnMessage(res: LeaveWithdrawn): string {
  const done = res.attendance.removed > 0
    ? "Approval withdrawn — the shift is unmarked again."
    : res.attendance.unapproved > 0
      ? "Approval withdrawn — the shift stays marked on leave, now unapproved."
      : "Approval withdrawn.";
  return res.payslipFinal
    ? `${done} That month's payslip is already finalised, so the pay on it stays as it was.`
    : done;
}

function LeaveCard({ l, children }: { l: LeaveRow; children: ReactNode }) {
  const name = l.employeeName && l.employeeName !== "–" ? l.employeeName : "";
  return (
    <Card className="p-4 flex flex-wrap items-center gap-4">
      <span className="h-10 w-10 rounded-full bg-brand-100 text-brand-600 grid place-items-center font-bold uppercase">
        {name.charAt(0) || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{name || "—"}</p>
        <p className="text-xs text-ink-400">
          <span className="capitalize">{l.employeeDept && l.employeeDept !== "–" ? `${l.employeeDept} · ` : ""}</span>
          {leaveKind(l)}
        </p>
        {l.reason && <p className="mt-1 text-sm text-ink-600">{l.reason}</p>}
      </div>
      <div className="text-right text-sm">
        <p className="font-medium">{dayLabel(l.date)}</p>
        {l.createdAt && <p className="text-xs text-ink-400">requested {formatDate(l.createdAt)}</p>}
      </div>
      <span className="flex gap-1.5">{children}</span>
    </Card>
  );
}

export function LeavePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  // Pending approve/reject decision awaiting confirmation.
  const [decision, setDecision] = useState<{ id: string; name: string; action: "approve" | "reject" } | null>(null);
  // An approval about to be taken back, and why.
  const [withdrawing, setWithdrawing] = useState<LeaveRow | null>(null);
  const [withdrawNote, setWithdrawNote] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leave", "pending"],
    queryFn: leaveService.pending,
  });
  const from = monthStart();
  const approved = useQuery({
    queryKey: ["leave", "approved", from],
    queryFn: () => leaveService.list({ status: "approved", from }),
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
  const withdraw = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => leaveService.withdraw(id, note || undefined),
    onSuccess: invalidate,
  });

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle="Requests waiting for a decision, and the leave already approved. Approved leave feeds attendance."
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
            const name = l.employeeName && l.employeeName !== "–" ? l.employeeName : "this worker";
            return (
              <LeaveCard key={l.id} l={l}>
                <Button size="sm" onClick={() => setDecision({ id: l.id, name, action: "approve" })}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDecision({ id: l.id, name, action: "reject" })}>
                  <X className="h-4 w-4" /> Reject…
                </Button>
              </LeaveCard>
            );
          })}
        </div>
      )}

      {/* What has been approved, from the start of this month: the only
          place an approval can be seen again, and taken back. */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-600">Approved leave, this month onwards</h2>
      {approved.isError ? (
        <ErrorBanner message={(approved.error as Error).message} />
      ) : approved.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (approved.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-400">No leave approved from {dayLabel(from)} on.</p>
      ) : (
        <div className="space-y-3">
          {approved.data!.map((l) => (
            <LeaveCard key={l.id} l={l}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setWithdrawNote(""); setWithdrawing(l); }}
              >
                <Undo2 className="h-4 w-4" /> Withdraw
              </Button>
            </LeaveCard>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={decision !== null}
        title={decision?.action === "reject" ? "Reject leave?" : "Approve leave?"}
        message={
          decision?.action === "reject"
            ? `Reject the leave request from ${decision?.name}?`
            : `Approve the leave request from ${decision?.name}? This marks the day as leave in their attendance.`
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

      <ConfirmDialog
        open={withdrawing !== null}
        title="Withdraw this approval?"
        message={
          <div className="space-y-3">
            <p>
              {withdrawing?.employeeName ?? "This worker"}'s leave on {dayLabel(withdrawing?.date)} stops being
              approved. If nobody has marked the shift since, it goes back to unmarked; a shift marked on leave by
              hand stays that way and counts as an absence.
            </p>
            <Input
              label="Why (optional)"
              placeholder="e.g. Coming in after all"
              maxLength={300}
              value={withdrawNote}
              onChange={(e) => setWithdrawNote(e.target.value)}
            />
          </div>
        }
        confirmLabel="Withdraw approval"
        danger
        wide
        loading={withdraw.isPending}
        onCancel={() => setWithdrawing(null)}
        onConfirm={() => {
          if (!withdrawing) return;
          withdraw.mutate(
            { id: withdrawing.id, note: withdrawNote.trim() },
            {
              onSuccess: (res) => {
                toast(withdrawnMessage(res), res.payslipFinal ? "info" : "success");
                setWithdrawing(null);
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Could not withdraw the approval", "error"),
            }
          );
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
