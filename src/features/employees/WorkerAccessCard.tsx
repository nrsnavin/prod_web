import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, ShieldOff, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/components/ui/ErrorState";
import { formatDate } from "@/core/format/date";
import { WorkerAccess, workerAccessService } from "./workerAccess";

// ══════════════════════════════════════════════════════════════════
//  APP ACCESS — an admin gives a worker phone + PIN sign-in
//
//  Workers sign in with the phone number on this record and a PIN set
//  here. Admin only: the card is not rendered for anyone else, and the
//  server refuses them regardless.
//
//  The PIN is shown once, right after it is set, so the admin can tell
//  the worker. It is never shown again; a forgotten PIN is reset.
// ══════════════════════════════════════════════════════════════════

const spaced = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

/** Mirrors the server's rules, so most mistakes are caught before sending. */
export function pinProblem(pin: string, phone: string | null): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "The PIN must be 4 to 6 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Choose a PIN that is not one digit repeated.";
  const d = [...pin].map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((x, i) => i === 0 || x - d[i - 1] === step)) {
    return "Choose a PIN that is not a run of digits like 1234.";
  }
  if (phone && phone.endsWith(pin)) return "Choose a PIN that is not the end of the phone number.";
  return null;
}

/** A random 4-digit PIN the rules accept. */
export function suggestPin(phone: string | null): string {
  for (;;) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const pin = String(buf[0] % 10000).padStart(4, "0");
    if (!pinProblem(pin, phone)) return pin;
  }
}

export function WorkerAccessCard({ empId }: { empId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["worker-access", empId];
  const { data, isLoading, isError, error } = useQuery({
    queryKey: key,
    queryFn: () => workerAccessService.get(empId),
    retry: false,
  });
  const [setting, setSetting] = useState(false);
  const [turningOff, setTurningOff] = useState(false);

  const turnOff = useMutation({
    mutationFn: () => workerAccessService.turnOff(empId),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      setTurningOff(false);
      toast("Phone sign-in turned off", "success");
    },
    onError: (e) => toast(errorMessage(e, "app access"), "error"),
  });

  return (
    <Card className="mt-4 p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4 text-ink-400" aria-hidden /> App access
      </h3>
      {isLoading ? (
        <Skeleton className="mt-3 h-12 w-full" />
      ) : isError || !data ? (
        <p className="mt-2 text-sm text-status-danger">{errorMessage(error, "app access")}</p>
      ) : (
        <AccessBody
          access={data}
          onSet={() => setSetting(true)}
          onTurnOff={() => setTurningOff(true)}
        />
      )}

      {data && (
        <SetPinDialog
          open={setting}
          access={data}
          onClose={() => setSetting(false)}
          onDone={(next) => qc.setQueryData(key, next)}
        />
      )}
      <ConfirmDialog
        open={turningOff}
        title="Turn off phone sign-in?"
        message={`${data?.employee.name ?? "They"} will be signed out on every phone and won't be able to sign in until you set a new PIN.`}
        confirmLabel="Turn off"
        danger
        loading={turnOff.isPending}
        onConfirm={() => turnOff.mutate()}
        onCancel={() => setTurningOff(false)}
      />
    </Card>
  );
}

function AccessBody({
  access,
  onSet,
  onTurnOff,
}: {
  access: WorkerAccess;
  onSet: () => void;
  onTurnOff: () => void;
}) {
  const { employee, login } = access;
  const phone = employee.phoneNumber && /^\d{10}$/.test(employee.phoneNumber) ? employee.phoneNumber : null;

  if (login && !login.selfService) {
    return (
      <p className="mt-2 text-sm text-ink-600">
        {employee.name} signs in with a manager login{login.email ? <> ({login.email})</> : null}. Phone
        and PIN sign-in is only for worker logins, which see just their own shift, performance and pay.
      </p>
    );
  }

  if (!phone) {
    return (
      <p className="mt-2 text-sm text-ink-600">
        Add a 10-digit phone number to this employee first. It is what they sign in with.
      </p>
    );
  }

  if (!login?.phoneSignIn) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">
          {login
            ? `${employee.name} has a worker login, but phone sign-in is off.`
            : `${employee.name} can't sign in to the app yet.`}{" "}
          Set a PIN and they sign in with {spaced(phone)}.
        </p>
        <Button onClick={onSet}>
          <KeyRound className="h-4 w-4" aria-hidden /> Give app access
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-600">
        <span>
          Signs in with <span className="font-medium text-ink-900 tabular-nums">{spaced(phone)}</span> and a PIN.
        </span>
        {login.lockedUntil ? (
          <StatusChip tone="danger">
            <Lock className="mr-1 inline h-3 w-3" aria-hidden />
            Locked after wrong PINs
          </StatusChip>
        ) : (
          <StatusChip tone="success">On</StatusChip>
        )}
      </div>
      {login.since && <p className="text-xs text-ink-400">Worker login since {formatDate(login.since)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onSet}>
          <KeyRound className="h-4 w-4" aria-hidden /> {login.lockedUntil ? "Reset PIN and unlock" : "Reset PIN"}
        </Button>
        <Button variant="ghost" onClick={onTurnOff}>
          <ShieldOff className="h-4 w-4" aria-hidden /> Turn off
        </Button>
      </div>
    </div>
  );
}

function SetPinDialog({
  open,
  access,
  onClose,
  onDone,
}: {
  open: boolean;
  access: WorkerAccess;
  onClose: () => void;
  onDone: (next: WorkerAccess) => void;
}) {
  const phone = access.employee.phoneNumber ?? null;
  const resetting = !!access.login?.phoneSignIn;
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  // What was set, and whether it replaced a PIN — fixed when it is set,
  // because the access shown above changes the moment it saves.
  const [given, setGiven] = useState<{ pin: string; reset: boolean } | null>(null);
  const reset = given ? given.reset : resetting;

  const save = useMutation({
    mutationFn: (p: string) => workerAccessService.setPin(access.employee.id, p),
    onSuccess: (next, p) => {
      setGiven({ pin: p, reset: resetting });
      onDone(next);
    },
    onError: (e) => setError(errorMessage(e, "the PIN")),
  });

  const close = () => {
    setPin("");
    setError(null);
    setGiven(null);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = pinProblem(pin, phone);
    if (problem) return setError(problem);
    setError(null);
    save.mutate(pin);
  };

  return (
    <Modal open={open} onClose={close} title={reset ? "Reset PIN" : "Give app access"} width="max-w-sm" confirmDirtyClose={!given}>
      {given ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Tell {access.employee.name} their PIN now. It won't be shown again.
          </p>
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-ink-50 p-4">
            <div>
              <dt className="text-xs text-ink-400">Phone number</dt>
              <dd className="font-semibold tabular-nums">{phone ? spaced(phone) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">PIN</dt>
              <dd className="text-2xl font-bold tracking-[0.3em] tabular-nums" data-testid="given-pin">{given.pin}</dd>
            </div>
          </dl>
          {given.reset && (
            <p className="text-xs text-ink-400">They have been signed out on every phone and sign in again with this PIN.</p>
          )}
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-ink-600">
            {access.employee.name} will sign in with {phone ? spaced(phone) : "their phone number"} and this PIN, and see
            only their own shift, performance and pay.
          </p>
          <div className="flex items-end gap-2">
            <Input
              label="PIN"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              hint="4 to 6 digits"
              error={error ?? undefined}
              className="tracking-[0.3em]"
              autoFocus
            />
            <Button type="button" variant="secondary" className="mb-[1.375rem] shrink-0" onClick={() => {
              setPin(suggestPin(phone));
              setError(null);
            }}>
              Suggest
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{resetting ? "Reset PIN" : "Set PIN"}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
