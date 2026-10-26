import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useEmployeeMutations } from "./hooks";
import { LaterShift, OFFBOARD_REASON_LABELS, OffboardReason, OffboardResult } from "./types";

/** Today in the browser's own calendar, "YYYY-MM-DD". */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Someone leaves. Asks for their last working day and why; their shifts,
 * attendance, pay and bonus all stay. Refused (and the shifts named)
 * while they are still on a shift after that day.
 */
export function OffboardDialog({ empId, name, onClose }: { empId: string; name: string; onClose: () => void }) {
  const { toast } = useToast();
  const { offboard } = useEmployeeMutations();
  const [lastWorkingDay, setLastWorkingDay] = useState(today());
  const [reason, setReason] = useState<OffboardReason | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [laterShifts, setLaterShifts] = useState<LaterShift[]>([]);
  const [done, setDone] = useState<OffboardResult | null>(null);

  const submit = () => {
    setError(null);
    setLaterShifts([]);
    if (!lastWorkingDay) { setError("Enter their last working day."); return; }
    if (!reason) { setError("Choose why they are leaving."); return; }
    offboard.mutate(
      { id: empId, lastWorkingDay, reason, note: note.trim() || undefined },
      {
        onSuccess: (res) => {
          toast(`${name} offboarded`, "success");
          setDone(res);
        },
        onError: (e) => {
          setError(e instanceof ApiError ? e.message : "Could not offboard");
          if (e instanceof ApiError && e.code === "EMPLOYEE_HAS_LATER_SHIFTS") {
            const details = e.data?.details as { shifts?: LaterShift[] } | undefined;
            setLaterShifts(details?.shifts ?? []);
          }
        },
      }
    );
  };

  return (
    <Modal open onClose={onClose} title={`Offboard ${name}`} width="max-w-md">
      {done ? (
        <div className="space-y-3 text-sm">
          <p>
            {name} is recorded as leaving after {formatDate(done.employee.lastWorkingDay)}. Their shifts,
            attendance, pay and bonus are kept; from the next day they are no longer offered for shifts.
          </p>
          {done.workerLoginClosed && <p>Their phone sign-in is turned off and any open session ended.</p>}
          {done.managerLogin && (
            <p role="alert" className="rounded-lg bg-status-warningBg px-3 py-2 text-status-warning">
              They still have a manager login ({done.managerLogin.email}), and it still works.{" "}
              <Link to="/users" className="font-medium underline">Remove it under Users</Link>.
            </p>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Nothing of theirs is deleted. From the day after their last working day they are left out of
            shift planning and the rosters, and cannot sign in. You can reinstate them if they come back.
          </p>
          <Input
            label="Last working day"
            type="date"
            value={lastWorkingDay}
            onChange={(e) => setLastWorkingDay(e.target.value)}
          />
          <Select
            label="Reason"
            value={reason}
            placeholder="Choose…"
            onChange={(e) => setReason(e.target.value as OffboardReason | "")}
            options={(Object.keys(OFFBOARD_REASON_LABELS) as OffboardReason[]).map((r) => ({ value: r, label: OFFBOARD_REASON_LABELS[r] }))}
          />
          <Input
            label="Note (optional)"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. full and final settled on 5 Nov"
          />
          {error && (
            <div role="alert" className="space-y-2 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">
              <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}</p>
              {laterShifts.length > 0 && (
                <ul className="ml-6 list-disc text-ink-700">
                  {laterShifts.map((s) => (
                    <li key={s.id}>
                      {formatDate(s.date)}
                      {s.shift ? ` · ${s.shift === "DAY" ? "Day" : s.shift === "NIGHT" ? "Night" : s.shift}` : ""}
                      {s.machine ? ` · ${s.machine}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={offboard.isPending}>Cancel</Button>
            <Button type="button" variant="danger" loading={offboard.isPending} onClick={submit}>Offboard</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
