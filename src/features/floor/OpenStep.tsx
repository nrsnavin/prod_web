import { useState } from "react";
import { Moon, Sun, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { floorService, OpenResult } from "./floorClient";
import { shiftNow } from "./floorRules";
import type { Shift } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STEP 1 — WHICH SHIFT, WHO, AND THE PIN
//
//  Opens on the shift running now. The name is remembered on the
//  device: the same supervisor opens the floor most days.
// ══════════════════════════════════════════════════════════════════

const NAME_KEY = "jarvis.floor.name";
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; } };
const rememberName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* a convenience */ } };

const dateWords = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export function OpenStep({ onOpened, initial }: { onOpened: (r: OpenResult) => void; initial?: { dateKey: string; shift: Shift } }) {
  const now = shiftNow();
  const [dateKey, setDateKey] = useState(initial?.dateKey ?? now.dateKey);
  const [shift, setShift] = useState<Shift>(initial?.shift ?? now.shift);
  const [name, setName] = useState(readName);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notNow = dateKey !== now.dateKey || shift !== now.shift;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Type your name, so the entries say who made them.");
    if (!/^\d{4}$/.test(pin)) return setError("The PIN is four digits.");
    setBusy(true);
    try {
      const out = await floorService.open({ dateKey, shift, pin, name: name.trim() });
      rememberName(name.trim());
      onOpened(out);
    } catch (err) {
      setPin(""); // a wrong PIN is typed again, not edited
      setError(err instanceof ApiError ? err.message : "Could not open the shift — check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Open the shift</h2>
        <p className="mt-1 text-sm text-ink-500">Ask the admin for this shift&apos;s PIN — it is on the shift card under Shift Plans.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} required />
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink-600">Shift</span>
          <div className="grid h-10 grid-cols-2 overflow-hidden rounded-lg border border-ink-200" role="radiogroup" aria-label="Shift">
            {([["DAY", "Day", Sun], ["NIGHT", "Night", Moon]] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={shift === value}
                onClick={() => setShift(value)}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors",
                  shift === value ? "bg-brand-500 text-white" : "bg-surface text-ink-600 hover:bg-ink-100"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notNow && (
        <p className="rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          The shift running now is the {now.shift === "DAY" ? "day" : "night"} shift of {dateWords(now.dateKey)}.{" "}
          <button type="button" className="font-semibold underline" onClick={() => { setDateKey(now.dateKey); setShift(now.shift); }}>
            Use it
          </button>
        </p>
      )}

      <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Supervisor on this shift" />
      <Input
        label="Shift PIN"
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="••••"
        className="text-center text-xl tracking-[0.6em]"
      />

      {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        <LockKeyhole className="h-4 w-4" aria-hidden /> Open shift
      </Button>
    </form>
  );
}
