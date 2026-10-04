import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ClipboardEdit, Moon, Sun } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormScreen } from "@/components/ui/FormScreen";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/components/ui/ErrorState";
import { formatDate } from "@/core/format/date";
import { useSubmitProduction } from "./hooks";
import { TimerPhotoReader } from "@/features/shifts/TimerPhotoReader";
import { ExpectedOutput } from "@/features/productionModel/ExpectedOutput";
import { MyShift } from "./types";

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Tomorrow", "Yesterday" or the date — how a worker thinks of a shift. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = 86_400_000;
  if (sameDay(d, now)) return "Today";
  if (sameDay(d, new Date(now.getTime() + day))) return "Tomorrow";
  if (sameDay(d, new Date(now.getTime() - day))) return "Yesterday";
  return formatDate(iso);
}

export const shiftName = (s: "DAY" | "NIGHT") => (s === "NIGHT" ? "Night shift" : "Day shift");

/** What the worker has to do next on this shift, in their words. */
export function shiftStatus(s: MyShift): { tone: "warning" | "info"; text: string } {
  return s.status === "pending_verification"
    ? { tone: "info", text: "Waiting for verification" }
    : { tone: "warning", text: "Production to enter" };
}

/** Distinct elastics on the loom's heads, in head order. */
export function elasticsOn(s: MyShift): string[] {
  return [...new Set(s.heads.map((h) => h.elastic?.name).filter((n): n is string => !!n))];
}

export function ShiftCard({ shift, onEnter }: { shift: MyShift; onEnter: () => void }) {
  const status = shiftStatus(shift);
  const Icon = shift.shift === "NIGHT" ? Moon : Sun;
  const names = elasticsOn(shift);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
          <Icon className="h-4 w-4" aria-hidden />
          {dayLabel(shift.date)} · {shiftName(shift.shift)}
        </p>
        <StatusChip tone={status.tone}>{status.text}</StatusChip>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight">{shift.machine?.code ?? "No loom yet"}</p>
      <p className="mt-0.5 text-sm text-ink-500">
        {shift.machine ? `${shift.machine.heads} heads` : "A supervisor has not put you on a loom"}
        {shift.job && <> · Job J-{shift.job.jobNo}{shift.job.orderNo != null && <> · Order #{shift.job.orderNo}</>}</>}
      </p>
      {names.length > 0 && <p className="mt-2 text-sm text-ink-700">{names.join(" · ")}</p>}

      {shift.submitted && (
        <p className="mt-3 rounded-lg bg-status-infoBg px-3 py-2 text-sm text-status-info">
          You entered {shift.submitted.production?.toLocaleString("en-IN") ?? 0} m
          {shift.submitted.timer && shift.submitted.timer !== "00:00:00" ? ` in ${shift.submitted.timer}` : ""}. A supervisor will
          verify it.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onEnter}>
          <ClipboardEdit className="h-4 w-4" />
          {shift.status === "pending_verification" ? "Change my entry" : "Enter production"}
        </Button>
        <Link
          to="/my/shift"
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-ink-200 bg-surface px-4 text-sm font-medium text-ink-900 hover:border-ink-400"
        >
          Loom and elastics <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

const TIMER = /^\d{1,2}:[0-5]\d(:[0-5]\d)?$/;
/** "7.30" → "7:30": the phone's number keypad has a point but no colon. */
export const normaliseTimer = (t: string) => t.trim().replace(/[.,]/g, ":");

/** Entering production for the worker's own shift. */
export function EnterProductionScreen({ shift, onClose }: { shift: MyShift | null; onClose: () => void }) {
  const submit = useSubmitProduction();
  const { toast } = useToast();
  const [metres, setMetres] = useState("");
  const [timer, setTimer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shift) return;
    setMetres(shift.submitted?.production != null ? String(shift.submitted.production) : "");
    const t = shift.submitted?.timer;
    setTimer(t && t !== "00:00:00" ? t : "");
    setNote(shift.submitted?.feedback ?? "");
    setError(null);
  }, [shift]);

  if (!shift) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = Number(metres);
    if (metres.trim() === "" || !Number.isFinite(m) || m < 0) return setError("Enter the metres produced.");
    const runTime = normaliseTimer(timer);
    if (runTime && !TIMER.test(runTime)) return setError("Write the run time like 7:30 or 7.30.");
    setError(null);
    submit.mutate(
      { shiftId: shift.id, production: m, timer: runTime || undefined, feedback: note.trim() || undefined },
      {
        onSuccess: () => {
          toast("Sent for verification", "success");
          onClose();
        },
        onError: (err) => setError(errorMessage(err, "your entry")),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title="Enter production">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-ink-500">
          {dayLabel(shift.date)} · {shiftName(shift.shift)} · {shift.machine?.code ?? "—"}
        </p>
        <Input
          label="Metres produced"
          type="number"
          min={0}
          step="any"
          value={metres}
          onChange={(e) => setMetres(e.target.value)}
          error={error && /metres/i.test(error) ? error : undefined}
          autoFocus
        />
        <ExpectedOutput shiftId={shift.id} runTime={timer} entered={metres} mine />
        <Input
          label="Run time"
          hint="Hours and minutes the loom ran, like 7:30 or 7.30"
          inputMode="decimal"
          placeholder="7:30"
          value={timer}
          onChange={(e) => setTimer(e.target.value)}
          error={error && /run time/i.test(error) ? error : undefined}
        />
        <TimerPhotoReader onUse={setTimer} />
        <div className="space-y-1.5">
          <label htmlFor="shift-note" className="block text-sm font-medium text-ink-600">
            Note for the supervisor
          </label>
          <textarea
            id="shift-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Breakdowns, yarn trouble, anything they should know"
            className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        {error && !/metres|run time/i.test(error) && (
          <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submit.isPending}>Send for verification</Button>
        </div>
      </form>
    </FormScreen>
  );
}
