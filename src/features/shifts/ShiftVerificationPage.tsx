import { useState } from "react";
import { ShieldCheck, Sun, Moon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { usePendingVerification, useShiftMutations } from "./hooks";
import { PendingShift } from "./types";

function VerifyModal({
  shift,
  onClose,
}: {
  shift: PendingShift;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { verify } = useShiftMutations();
  const [meters, setMeters] = useState(String(shift.productionMeters ?? ""));
  const [timer, setTimer] = useState(shift.timer ?? "");
  const [note, setNote] = useState("");

  const jobNo = shift.machine?.orderRunning?.jobOrderNo ?? shift.job?.jobOrderNo;

  return (
    <Modal open onClose={onClose} title="Verify shift production" width="max-w-md">
      <div className="space-y-4">
        <div className="rounded-xl bg-ink-100/60 p-3 text-sm">
          <p className="font-semibold">{shift.employee?.name ?? "Operator"}</p>
          <p className="text-ink-600">
            {shift.machine?.ID ?? "Machine"} {jobNo && `· J-${jobNo}`} ·{" "}
            {shift.shiftPlan?.shift ?? ""}{" "}
            {shift.shiftPlan?.date && `· ${new Date(shift.shiftPlan.date).toLocaleDateString()}`}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Worker submitted: {(shift.productionMeters ?? 0).toLocaleString()} m · {shift.timer ?? "—"}
          </p>
        </div>

        <Input
          label="Verified production (m) *"
          type="number"
          step="0.01"
          value={meters}
          onChange={(e) => setMeters(e.target.value)}
        />
        <Input
          label="Runtime (HH:MM:SS)"
          value={timer}
          onChange={(e) => setTimer(e.target.value)}
        />
        <Input
          label="Note"
          placeholder="Optional — reason for correction"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!meters}
            loading={verify.isPending}
            onClick={() =>
              verify.mutate(
                {
                  shiftId: shift._id,
                  productionMeters: Number(meters),
                  timer: timer || undefined,
                  note: note || undefined,
                },
                {
                  onSuccess: () => {
                    toast("Shift verified — production cascaded to job & order", "success");
                    onClose();
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Verification failed", "error"),
                }
              )
            }
          >
            <ShieldCheck className="h-4 w-4" /> Verify & close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ShiftVerificationPage() {
  const { data, isLoading, isError, error } = usePendingVerification();
  const [verifying, setVerifying] = useState<PendingShift | null>(null);

  return (
    <>
      <PageHeader
        title="Shift verification"
        subtitle="Worker-submitted production awaiting your sign-off. Verified numbers cascade to the job, order and shift plan."
      />

      {isError && (
        <p className="mb-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
          {(error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.shifts.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="h-12 w-12" />}
            title="All caught up"
            description="No shifts pending verification."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.shifts.map((s) => {
            const jobNo = s.machine?.orderRunning?.jobOrderNo ?? s.job?.jobOrderNo;
            const customer =
              s.machine?.orderRunning?.customer?.name ?? s.job?.customer?.name ?? "";
            return (
              <Card key={s._id} className="p-4 flex flex-wrap items-center gap-4">
                <span className="h-10 w-10 rounded-full bg-brand-100 text-brand-600 grid place-items-center font-bold uppercase">
                  {s.employee?.name?.charAt(0) ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.employee?.name ?? "Operator"}</p>
                  <p className="text-xs text-ink-400">
                    {s.machine?.ID ?? "—"} {jobNo && `· J-${jobNo}`} {customer && `· ${customer}`}
                  </p>
                </div>
                <StatusChip tone={s.shiftPlan?.shift === "DAY" ? "info" : "neutral"}>
                  <span className="inline-flex items-center gap-1">
                    {s.shiftPlan?.shift === "DAY" ? (
                      <Sun className="h-3 w-3" />
                    ) : (
                      <Moon className="h-3 w-3" />
                    )}
                    {s.shiftPlan?.shift ?? "—"}
                  </span>
                </StatusChip>
                <div className="text-right">
                  <p className="font-bold tabular-nums">
                    {(s.productionMeters ?? 0).toLocaleString()} m
                  </p>
                  <p className="text-xs text-ink-400">{s.timer ?? "—"}</p>
                </div>
                <Button size="sm" onClick={() => setVerifying(s)}>
                  <ShieldCheck className="h-4 w-4" /> Verify
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {verifying && <VerifyModal shift={verifying} onClose={() => setVerifying(null)} />}
    </>
  );
}
