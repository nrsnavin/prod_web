import { useCallback, useEffect, useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { floorService, floorTokenStore } from "./floorClient";
import { OpenStep } from "./OpenStep";
import { ScanStep } from "./ScanStep";
import { EntryStep } from "./EntryStep";
import type { FloorMachine, FloorSession, FloorState } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR-ENTRY SCREEN — /floor, no login
//
//  A supervisor on the floor tablet opens one shift with its PIN, scans
//  each loom's label, says who ran it and enters what it made. Three
//  steps, one screen, built for a phone held in one hand. When nobody
//  planned the shift, choosing the operator notes the loom on a draft
//  the office can see, and Create shift plan — pressed when every
//  machine's production is in — makes the draft the plan.
//
//    open  →  scan  ⇄  entry
//
//  The token lives for the shift; when it ends, or the admin changes
//  the PIN, the PIN is asked for again where the supervisor stands,
//  and nothing typed is lost.
// ══════════════════════════════════════════════════════════════════

type Phase =
  | { kind: "booting" }
  | { kind: "open" }
  | { kind: "scan" }
  | { kind: "entry"; machine: FloorMachine };

const isAuthLost = (e: unknown) => e instanceof ApiError && e.status === 401;

export function FloorPage() {
  const { toast } = useToast();
  const [session, setSession] = useState<FloorSession | null>(() => floorTokenStore.read()?.session ?? null);
  const [state, setState] = useState<FloorState | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (floorTokenStore.read() ? { kind: "booting" } : { kind: "open" }));
  const [pinAgain, setPinAgain] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const authLost = useCallback(() => setPinAgain(true), []);

  const refresh = useCallback(async (): Promise<FloorState | null> => {
    setRefreshing(true);
    try {
      const next = await floorService.shift();
      setState(next);
      return next;
    } catch (e) {
      if (isAuthLost(e)) authLost();
      else toast(e instanceof ApiError ? e.message : "Could not refresh the shift.", "error");
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [authLost, toast]);

  // A reload mid-shift: the token is kept, the state is fetched again.
  useEffect(() => {
    if (phase.kind !== "booting") return;
    (async () => {
      try {
        const next = await floorService.shift();
        setState(next);
        setPhase({ kind: "scan" });
      } catch {
        floorTokenStore.clear();
        setSession(null);
        setPhase({ kind: "open" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeShift = () => {
    floorTokenStore.clear();
    setSession(null);
    setState(null);
    setPhase({ kind: "open" });
  };

  const current = state?.machines.find((m) => phase.kind === "entry" && m.id === phase.machine.id);

  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <header
        className="sticky top-0 z-10 border-b border-ink-100 bg-surface/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-white">
            <BrandMark className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {session ? (
                <span className="inline-flex items-center gap-1.5">
                  {session.shift === "DAY" ? <Sun className="h-4 w-4 text-ink-400" aria-hidden /> : <Moon className="h-4 w-4 text-ink-400" aria-hidden />}
                  {state?.label ?? `${session.shift === "DAY" ? "Day" : "Night"} shift · ${session.dateKey}`}
                </span>
              ) : "Floor entry"}
            </p>
            <p className="truncate text-xs text-ink-400">{session ? session.name : "Production, loom by loom"}</p>
          </div>
          {session && (
            <button type="button" onClick={changeShift} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-900">
              <LogOut className="h-4 w-4" aria-hidden /> Change shift
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        {state && !state.isCurrent && phase.kind !== "open" && (
          <p className="mb-4 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning" role="status">
            This is not the shift running now. Entries go to {state.label}.
          </p>
        )}
        {state?.plan?.finalized && phase.kind !== "open" && (
          <p className="mb-4 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger" role="status">
            This shift is finalised — nothing more can be entered. Ask the office to reopen it if something is missing.
          </p>
        )}

        {phase.kind === "booting" && (
          <div className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
        )}

        {phase.kind === "open" && (
          <div className="rounded-2xl border border-ink-200 bg-surface p-5 shadow-card">
            <OpenStep
              initial={session ?? undefined}
              onOpened={(r) => {
                setSession(r.session);
                setState(r.state);
                setPhase({ kind: "scan" });
              }}
            />
          </div>
        )}

        {phase.kind === "scan" && state && (
          <ScanStep
            state={state}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            onAuthLost={authLost}
            onCompleted={(r) => {
              const free = r.freeMachines.length;
              toast(`Shift plan created — the office confirms it. ${free ? `${free} loom${free === 1 ? "" : "s"} free: ${r.freeMachines.map((f) => f.ID).join(", ")}.` : "No loom was free."}`, "success");
              setState((s) => s ? { ...s, plan: r.plan } : s);
              void refresh();
            }}
            onMachine={(m) => {
              setPhase({ kind: "entry", machine: m });
              // A loom tapped in the list comes from the state as last
              // fetched; another tablet may have entered it since.
              void refresh();
            }}
          />
        )}

        {phase.kind === "entry" && state && (
          <EntryStep
            key={phase.machine.id}
            machine={current ?? phase.machine}
            state={state}
            onBack={() => setPhase({ kind: "scan" })}
            onAuthLost={authLost}
            onPlanMade={() => {
              toast("Draft started with this loom — press Create shift plan when every machine is entered", "info");
              void refresh();
            }}
            onSaved={({ machine: m, plan }) => {
              toast(`${m.ID} saved — ${m.detail?.submitted?.production ?? 0} m/head`, "success");
              setState((s) => s ? { ...s, plan: plan ?? s.plan, machines: s.machines.map((x) => (x.id === m.id ? m : x)) } : s);
              setPhase({ kind: "scan" });
              void refresh();
            }}
          />
        )}
      </main>

      {session && (
        <PinAgainDialog
          open={pinAgain}
          session={session}
          onOpened={(r) => {
            setPinAgain(false);
            setSession(r.session);
            setState(r.state);
            if (phase.kind === "booting" || phase.kind === "open") setPhase({ kind: "scan" });
          }}
          onChangeShift={() => { setPinAgain(false); changeShift(); }}
        />
      )}
    </div>
  );
}

/** The shift ended or its PIN was changed: the PIN again, where the supervisor stands. */
function PinAgainDialog({ open, session, onOpened, onChangeShift }: {
  open: boolean;
  session: FloorSession;
  onOpened: (r: Awaited<ReturnType<typeof floorService.open>>) => void;
  onChangeShift: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onOpened(await floorService.open({ dateKey: session.dateKey, shift: session.shift, pin, name: session.name }));
      setPin("");
    } catch (err) {
      setPin("");
      setError(err instanceof ApiError ? err.message : "Could not open the shift — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => undefined} title="Enter the PIN again" width="max-w-sm" confirmDirtyClose={false}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-ink-600">
          This floor session has ended, or the shift PIN was changed. Nothing is lost — enter the current PIN to carry on.
        </p>
        <Input
          label="Shift PIN"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          autoFocus
          className="text-center text-xl tracking-[0.6em]"
        />
        {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={pin.length !== 4}>Carry on</Button>
        <button type="button" onClick={onChangeShift} className="block w-full text-center text-sm font-medium text-ink-500 hover:text-ink-900">
          Open a different shift
        </button>
      </form>
    </Modal>
  );
}
