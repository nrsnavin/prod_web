import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { attendanceService, AttendanceRecord, MarkCorrection } from "./api";

// ══════════════════════════════════════════════════════════════════
//  PUTTING ONE MARK RIGHT
//
//  The attendance page could mark the people not yet marked and nothing
//  else: a mark made wrongly stayed wrong, and a shift whose clock-out
//  was forgotten (pressed days later, or never) could not be given its
//  real hours from any screen.
//
//  Only what is changed here is sent. The server leaves every other
//  field as it stands, so opening this and saving changes nothing.
// ══════════════════════════════════════════════════════════════════

export const STATUS_OPTIONS = ["present", "late", "half_day", "absent", "on_leave"];
const LEAVE_TYPES = ["", "casual", "sick", "emergency", "personal", "unpaid"];

/** Longer than this on the timer is not a shift: a clock-out forgotten. */
export const TOO_LONG_FOR_A_SHIFT_MIN = 16 * 60;

const pad = (n: number) => String(n).padStart(2, "0");

/** "08:02" in the viewer's own time. */
export function clockTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * When a timer stamp fell, for a column: the time alone on the day it
 * started, the date with it once it is another day — which is how a
 * clock-out pressed days later shows itself.
 */
export function stampLabel(iso?: string | null, sameDayAs?: string | null): string {
  if (!iso) return "";
  const time = clockTime(iso);
  if (!time) return "";
  if (sameDayAs && new Date(iso).toDateString() === new Date(sameDayAs).toDateString()) return time;
  if (!sameDayAs) return time;
  return `${formatDate(iso).replace(/ \d{4}$/, "")}, ${time}`;
}

export interface MarkForm {
  status: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  minutes: string;
  late: string;
  overtime: string;
  leaveType: string;
  notes: string;
}

/** A shift whose time is paid by the hours on it. */
const isWorked = (status: string) => status === "present" || status === "late";

/** The form as the record stands. */
export function formOf(r: AttendanceRecord): MarkForm {
  const worked = r.workedMinutes && r.workedMinutes > 0 ? r.workedMinutes : 0;
  // A timer still running has no figure yet: its minutes so far are only
  // the stints already clocked out of.
  const timerDone = !r.clockInAt || !!r.clockOutAt;
  return {
    status: r.status,
    checkIn: r.checkIn ?? "",
    checkOut: r.checkOut ?? "",
    hours: worked && timerDone ? String(Math.floor(worked / 60)) : "",
    minutes: worked && timerDone ? String(Math.round(worked % 60)) : "",
    late: r.lateMinutes ? String(r.lateMinutes) : "",
    overtime: r.overtimeMinutes ? String(r.overtimeMinutes) : "",
    leaveType: r.leaveType ?? "",
    notes: r.notes ?? "",
  };
}

const wholeNumber = (s: string) => (s.trim() === "" ? 0 : Number(s));

/** What is wrong with the form, in words; null when it can be sent. */
export function problemWith(form: MarkForm, timed: boolean): string | null {
  const numbers: Array<[string, string]> = [
    ["Hours", form.hours], ["Minutes", form.minutes],
    ["Late minutes", form.late], ["Overtime minutes", form.overtime],
  ];
  for (const [name, value] of numbers) {
    const n = wholeNumber(value);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return `${name} must be a whole number, 0 or more.`;
  }
  if (isWorked(form.status)) {
    if (timed) {
      const total = wholeNumber(form.hours) * 60 + wholeNumber(form.minutes);
      if (wholeNumber(form.minutes) > 59) return "Minutes go up to 59 — put the rest in hours.";
      if (total > 24 * 60) return "A shift cannot be longer than a day.";
    } else if (!form.checkIn !== !form.checkOut) {
      return "Give both the In and the Out time, or neither.";
    }
  }
  return null;
}

/**
 * What to send: only the fields changed from the record. Hours are sent
 * for a worked shift alone — for any other status they mean nothing, and
 * the server works the hours out from the status.
 */
export function correctionOf(record: AttendanceRecord, form: MarkForm): MarkCorrection {
  const was = formOf(record);
  const out: MarkCorrection = {};
  if (form.status !== was.status) out.status = form.status;
  if (isWorked(form.status)) {
    if (record.clockInAt) {
      const total = wholeNumber(form.hours) * 60 + wholeNumber(form.minutes);
      const before = wholeNumber(was.hours) * 60 + wholeNumber(was.minutes);
      if (total > 0 && total !== before) out.workedMinutes = total;
    } else {
      if (form.checkIn !== was.checkIn) out.checkIn = form.checkIn;
      if (form.checkOut !== was.checkOut) out.checkOut = form.checkOut;
    }
    if (wholeNumber(form.late) !== wholeNumber(was.late)) out.lateMinutes = wholeNumber(form.late);
    if (wholeNumber(form.overtime) !== wholeNumber(was.overtime)) out.overtimeMinutes = wholeNumber(form.overtime);
  }
  if (form.status === "on_leave" && form.leaveType !== was.leaveType) out.leaveType = form.leaveType;
  if (form.notes.trim() !== was.notes.trim()) out.notes = form.notes.trim();
  return out;
}

/** What the timer has on a shift, in a sentence. */
export function timerSummary(r: AttendanceRecord): string {
  if (!r.clockInAt) return "";
  const started = `${formatDate(r.clockInAt)}, ${clockTime(r.clockInAt)}`;
  if (!r.clockOutAt) return `Clocked in ${started} and never clocked out.`;
  return `Clocked in ${started} — clocked out ${stampLabel(r.clockOutAt, r.clockInAt)}.`;
}

export function CorrectMarkModal({ record, onClose }: { record: AttendanceRecord; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<MarkForm>(() => formOf(record));
  const set = (patch: Partial<MarkForm>) => setForm((f) => ({ ...f, ...patch }));
  const id = record._id ?? record.id ?? "";
  const name = record.employee?.name ?? record.name ?? "this employee";
  const timed = !!record.clockInAt;
  const worked = isWorked(form.status);
  const tooLong = timed && (record.workedMinutes ?? 0) > TOO_LONG_FOR_A_SHIFT_MIN;

  const save = useMutation({
    mutationFn: (body: MarkCorrection) => attendanceService.correct(id, body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-active"] });
      toast(
        res.payslipFinal
          ? "Corrected. This month's payslip is already finalised, so the pay on it stays as it was."
          : "Attendance corrected",
        res.payslipFinal ? "info" : "success"
      );
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not save the correction", "error"),
  });

  const submit = () => {
    const problem = problemWith(form, timed);
    if (problem) { toast(problem, "error"); return; }
    const body = correctionOf(record, form);
    if (Object.keys(body).length === 0) { onClose(); return; }
    save.mutate(body);
  };

  return (
    <FormScreen open onClose={onClose} title={`Correct attendance — ${name}`} width="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          {record.shift ?? ""} shift{record.dateLabel ? `, ${record.dateLabel}` : ""}
          {record.markedBy ? ` · marked by ${record.markedBy === "leave_approval" ? "leave approval" : record.markedBy}` : ""}
        </p>

        <Select
          label="Status"
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace("_", " ") }))}
          value={form.status}
          onChange={(e) => set({ status: e.target.value })}
        />

        {worked && timed && (
          <div className="space-y-2">
            <p className={`text-xs ${tooLong || !record.clockOutAt ? "text-status-warning" : "text-ink-400"}`}>
              {timerSummary(record)}
              {tooLong && " That is longer than a shift: enter the hours actually worked."}
              {!record.clockOutAt && " Enter the hours worked to close the shift."}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Hours worked"
                type="number"
                min={0}
                max={24}
                value={form.hours}
                onChange={(e) => set({ hours: e.target.value })}
              />
              <Input
                label="Minutes"
                type="number"
                min={0}
                max={59}
                value={form.minutes}
                onChange={(e) => set({ minutes: e.target.value })}
              />
            </div>
            <p className="text-xs text-ink-400">Pay follows these hours, up to 12 a shift; the rest is overtime.</p>
          </div>
        )}

        {worked && !timed && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <Input label="In" type="time" value={form.checkIn} onChange={(e) => set({ checkIn: e.target.value })} />
              <Input label="Out" type="time" value={form.checkOut} onChange={(e) => set({ checkOut: e.target.value })} />
            </div>
            <p className="text-xs text-ink-400">
              With In and Out the hours between them are paid (up to 12). Left blank, a full shift is paid.
            </p>
          </div>
        )}

        {worked && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Late (min)"
              type="number"
              min={0}
              value={form.late}
              onChange={(e) => set({ late: e.target.value })}
            />
            <Input
              label="Overtime (min)"
              type="number"
              min={0}
              hint="Used only when no hours are recorded"
              value={form.overtime}
              onChange={(e) => set({ overtime: e.target.value })}
            />
          </div>
        )}

        {form.status === "on_leave" && (
          <Select
            label="Leave type"
            options={LEAVE_TYPES.map((t) => ({ value: t, label: t ? t.charAt(0).toUpperCase() + t.slice(1) : "Not given" }))}
            value={form.leaveType}
            onChange={(e) => set({ leaveType: e.target.value })}
          />
        )}
        {form.status === "on_leave" && (
          <p className="text-xs text-ink-400">
            Leave is paid only when an approved request covers the shift — its type is then the one approved.
          </p>
        )}

        <Input
          label="Notes"
          maxLength={500}
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={submit}>Save correction</Button>
        </div>
      </div>
    </FormScreen>
  );
}
