import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarOff, CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, errorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { cn } from "@/components/ui/cn";
import { meService } from "./api";
import { useCancelLeave, useMyLeaves } from "./hooks";
import type { LeaveApplication, MyLeave } from "./types";
import {
  MAX_LEAVE_DAYS, SHIFT_OPTIONS, TYPE_OPTIONS, addDays, daysBetween, leaveShiftLabel, leaveStatusLabel,
  leaveTone, leaveTypeLabel, localISO, splitLeaves,
} from "./leave";

// ══════════════════════════════════════════════════════════════════
//  A WORKER'S LEAVE
//
//  Apply for a day, a shift, or a run of days; see where each request
//  stands; take back one that hasn't been decided. Everything here is
//  the worker's own: the server takes them from the login when they
//  apply, and refuses anyone else's requests.
//
//  Leave is recorded per day and shift, so a run of days is sent as one
//  request per day. Each answer is shown: a day already asked for is
//  said so, not lost in a single error.
// ══════════════════════════════════════════════════════════════════

const EARLIER_SHOWN = 10;

export function MyLeavePage() {
  const leaves = useMyLeaves();
  const [params, setParams] = useSearchParams();
  const [applying, setApplying] = useState(params.get("apply") === "1");
  const [cancelling, setCancelling] = useState<MyLeave | null>(null);
  const [showAllEarlier, setShowAllEarlier] = useState(false);
  const cancel = useCancelLeave();
  const { toast } = useToast();

  const today = localISO(new Date());
  const { upcoming, earlier } = useMemo(() => splitLeaves(leaves.data ?? [], today), [leaves.data, today]);
  const year = today.slice(0, 4);
  const thisYear = (leaves.data ?? []).filter((l) => l.date.startsWith(year));
  const count = (status: string) => thisYear.filter((l) => l.status === status).length;

  const openApply = () => setApplying(true);
  const closeApply = () => {
    setApplying(false);
    if (params.has("apply")) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle="Ask for time off and see where each request stands."
        actions={
          <Button onClick={openApply}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Apply for leave
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {([
          ["Waiting", count("pending"), "text-status-warning"],
          [`Approved in ${year}`, count("approved"), "text-status-success"],
          [`Not approved in ${year}`, count("rejected"), "text-status-danger"],
        ] as const).map(([label, n, color]) => (
          <Card key={label} className="p-4 text-center">
            <p className={cn("text-2xl font-bold tabular-nums", n ? color : "text-ink-900")}>
              {leaves.isLoading ? "—" : n}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">{label}</p>
          </Card>
        ))}
      </div>

      {leaves.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full rounded-card" />
      ) : leaves.isError ? (
        <Card className="mt-4">
          <ErrorState error={leaves.error} what="your leave" onRetry={() => leaves.refetch()} />
        </Card>
      ) : (leaves.data ?? []).length === 0 ? (
        <Card className="mt-4 p-6">
          <EmptyState
            icon={<CalendarOff />}
            title="No leave requested yet"
            description="Apply for leave and your supervisor will approve it here."
          />
        </Card>
      ) : (
        <>
          <LeaveList title="Coming up" leaves={upcoming} empty="Nothing booked from today on." onCancel={setCancelling} />
          {earlier.length > 0 && <LeaveList
            title="Earlier"
            leaves={showAllEarlier ? earlier : earlier.slice(0, EARLIER_SHOWN)}
            empty="Nothing before today."
            onCancel={setCancelling}
            more={!showAllEarlier && earlier.length > EARLIER_SHOWN ? () => setShowAllEarlier(true) : undefined}
            moreCount={earlier.length - EARLIER_SHOWN}
          />}
        </>
      )}

      <ApplyLeaveScreen open={applying} onClose={closeApply} existing={leaves.data ?? []} />

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel this request?"
        message={cancelling ? `${cancelling.dateLabel}, ${leaveShiftLabel(cancelling.shift).toLowerCase()}. You can apply again later.` : ""}
        confirmLabel="Cancel request"
        danger
        loading={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={() =>
          cancelling &&
          cancel.mutate(cancelling.id, {
            onSuccess: () => {
              toast("Request cancelled", "success");
              setCancelling(null);
            },
            onError: (e) => {
              toast(errorMessage(e, "the request"), "error");
              setCancelling(null);
            },
          })
        }
      />
    </>
  );
}

function LeaveList({
  title,
  leaves,
  empty,
  onCancel,
  more,
  moreCount = 0,
}: {
  title: string;
  leaves: MyLeave[];
  empty: string;
  onCancel: (l: MyLeave) => void;
  more?: () => void;
  moreCount?: number;
}) {
  return (
    <Card className="mt-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      {leaves.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {leaves.map((l) => (
            <li key={l.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{l.dateLabel}</p>
                  <p className="text-sm text-ink-500">
                    {leaveShiftLabel(l.shift)} · {leaveTypeLabel(l.leaveType)} leave
                  </p>
                </div>
                <StatusChip tone={leaveTone(l.status)}>{leaveStatusLabel(l.status)}</StatusChip>
              </div>
              {l.reason && <p className="mt-1 text-sm text-ink-600">{l.reason}</p>}
              {l.reviewNotes && (
                <p className="mt-1 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
                  <span className="font-medium">Supervisor’s note:</span> {l.reviewNotes}
                </p>
              )}
              {l.status === "pending" && (
                <button
                  type="button"
                  onClick={() => onCancel(l)}
                  className="mt-1 text-sm font-medium text-status-danger hover:underline"
                >
                  Cancel request
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {more && (
        <button type="button" onClick={more} className="mt-2 text-sm font-medium text-brand-600">
          Show {moreCount} more
        </button>
      )}
    </Card>
  );
}

// ── Applying ────────────────────────────────────────────────────────

type Outcome = { date: string; ok: boolean; message?: string };

function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink-600">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
              value === o.value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-ink-200 bg-surface text-ink-700 hover:border-ink-400"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ApplyLeaveScreen({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: MyLeave[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = localISO(new Date());
  const [from, setFrom] = useState(addDays(today, 1));
  const [to, setTo] = useState("");
  const [shift, setShift] = useState<LeaveApplication["shift"]>("BOTH");
  const [leaveType, setLeaveType] = useState<LeaveApplication["leaveType"]>("casual");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setFrom(addDays(today, 1));
    setTo("");
    setShift("BOTH");
    setLeaveType("casual");
    setReason("");
    setError(null);
    setOutcomes(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const last = to || from;
  const days = from && last >= from ? daysBetween(from, last) : [];
  const earliest = addDays(today, -30);
  const latest = addDays(today, 180);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!from) return setError("Pick the day the leave starts.");
    if (from < earliest || last > latest) return setError("Pick days from the last 30 days up to six months ahead.");
    if (last < from) return setError("The last day can't be before the first.");
    if (days.length > MAX_LEAVE_DAYS) return setError(`Apply for at most ${MAX_LEAVE_DAYS} days at a time.`);
    if (!reason.trim()) return setError("Say briefly why, so your supervisor can approve it.");
    setError(null);
    setSending(true);
    const results: Outcome[] = [];
    // One day at a time: the plant records leave per day and shift.
    for (const date of days) {
      const already = existing.find((l) => l.date === date && (l.shift === shift || l.shift === "BOTH" || shift === "BOTH"));
      if (already) {
        results.push({ date, ok: false, message: `already requested (${leaveStatusLabel(already.status).toLowerCase()})` });
        continue;
      }
      try {
        await meService.applyLeave({ date, shift, leaveType, reason: reason.trim() });
        results.push({ date, ok: true });
      } catch (err) {
        results.push({
          date,
          ok: false,
          message: err instanceof ApiError && err.status === 409 ? "already requested" : errorMessage(err, "this day"),
        });
      }
    }
    setSending(false);
    await qc.invalidateQueries({ queryKey: ["my-leaves"] });
    const sent = results.filter((r) => r.ok).length;
    if (sent === results.length) {
      toast(sent === 1 ? "Leave requested — waiting for approval" : `Leave requested for ${sent} days — waiting for approval`, "success");
      onClose();
    } else {
      setOutcomes(results);
    }
  };

  return (
    <FormScreen open onClose={onClose} title="Apply for leave">
      {outcomes ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            {outcomes.filter((o) => o.ok).length} of {outcomes.length} days were requested.
          </p>
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {outcomes.map((o) => (
              <li key={o.date} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="tabular-nums">{o.date.split("-").reverse().join("-")}</span>
                <span className={o.ok ? "text-status-success" : "text-status-danger"}>{o.ok ? "Requested" : o.message}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" min={earliest} max={latest} value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input
              label="To (optional)"
              type="date"
              min={from || earliest}
              max={latest}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              hint={days.length > 1 ? `${days.length} days` : "Leave empty for one day"}
            />
          </div>
          <ChoiceChips label="Which part" options={SHIFT_OPTIONS} value={shift} onChange={setShift} />
          <ChoiceChips label="Type of leave" options={TYPE_OPTIONS} value={leaveType} onChange={setLeaveType} />
          <div className="space-y-1.5">
            <label htmlFor="leave-reason" className="block text-sm font-medium text-ink-600">
              Reason
            </label>
            <textarea
              id="leave-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: family function, fever, hospital visit"
              className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={sending}>
              {days.length > 1 ? `Apply for ${days.length} days` : "Apply"}
            </Button>
          </div>
        </form>
      )}
    </FormScreen>
  );
}

export default MyLeavePage;
