import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  PREDICTED PRODUCTION (server: services/productionModel.js)
//
//  metres per head = the machine's learned rate × minutes run ÷ pick,
//  with each machine's rate learned from its own verified shifts. Read
//  by the machine page (the model and a "what if" calculator) and by
//  both production entry screens (what to expect beside the figure).
// ══════════════════════════════════════════════════════════════════

export interface Prediction {
  perHead: number;
  /** 8 shifts in 10 land between low and high. */
  low: number;
  high: number;
  /** Outside this, the figure is worth checking (1 in 50 would be). */
  checkLow: number;
  checkHigh: number;
  total: number;
  totalLow: number;
  totalHigh: number;
  basis: "machine" | "plant";
  shifts: number;
  minutes: number;
  pick: number;
  heads: number;
}

export interface MachineRate {
  basis: "machine" | "plant";
  shifts: number;
  /** 1.06 → 6% faster than the plant's typical loom. */
  speedIndex: number;
  /** Shifts usually land within ± this % of the prediction's centre. */
  scatterPct: number;
  metresPerHeadHour: number | null;
  pick: number | null;
}

export interface MethodScore {
  mae: number;
  medianErrorPct: number;
  within10Pct: number;
  rangeCoveragePct?: number;
}

export interface Evaluation {
  trainedOn: number;
  testedOn: number;
  testFrom: string;
  testTo: string;
  methods: {
    model: MethodScore;
    machineAverage: MethodScore;
    machinePerHour: MethodScore;
    plantPhysics: MethodScore;
  };
}

export interface MachineExpectation {
  available: boolean;
  reason: string | null;
  trainedAt: string;
  machine: { id: string; code: string; heads: number };
  elastics: Array<{ id: string; name: string | null; pick: number | null; heads: number }>;
  /** From the Elastic records of the elastics on the heads; never typed. */
  pick: number | null;
  /** Why there is no single pick: nothing threaded, a record without a pick, or records that disagree. */
  pickProblem: "no-elastics" | "no-pick" | "mixed" | null;
  summary: MachineRate | null;
  prediction: Prediction | null;
  runTimeFrom: "entered" | "full-shift" | "shift" | null;
  evaluation?: Evaluation | null;
}

/** What the entry screens get. A worker's own read carries less. */
export interface ShiftExpectation {
  available: boolean;
  reason: string | null;
  prediction: Prediction | null;
  runTimeFrom: "entered" | "shift" | null;
  pick: number | null;
  machine: { code: string; heads: number };
}

export const productionModelService = {
  machine(id: string, runTime?: string) {
    return httpClient.get<MachineExpectation>(`/production-model/machine/${encodeURIComponent(id)}`, runTime ? { runTime } : undefined);
  },
  shift(id: string, runTime?: string) {
    return httpClient.get<ShiftExpectation>(`/production-model/shift/${encodeURIComponent(id)}`, runTime ? { runTime } : undefined);
  },
  /** The worker's own shift. */
  myShift(id: string, runTime?: string) {
    return httpClient.get<ShiftExpectation>(`/me/shifts/${encodeURIComponent(id)}/expected`, runTime ? { runTime } : undefined);
  },
};

export function useMachineExpectation(id: string | undefined, runTime?: string) {
  return useQuery({
    queryKey: ["production-model", "machine", id, runTime ?? ""],
    queryFn: () => productionModelService.machine(id!, runTime),
    enabled: !!id,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

/** "7:45" or "07:45:12": the forms the server reads. */
export const RUN_TIME = /^\d{1,2}:[0-5]\d(:[0-5]\d)?$/;

/** A run time as typed ("7.45" on a phone keypad) → "7:45", or "" if not one yet. */
export function cleanRunTime(text: string): string {
  const t = text.trim().replace(/[.,]/g, ":");
  return RUN_TIME.test(t) ? t : "";
}

export function useShiftExpectation(shiftId: string | undefined, runTime: string, { mine = false } = {}) {
  const clean = cleanRunTime(runTime);
  return useQuery({
    queryKey: ["expected-output", mine ? "mine" : "shift", shiftId, clean],
    queryFn: () => (mine ? productionModelService.myShift(shiftId!, clean || undefined) : productionModelService.shift(shiftId!, clean || undefined)),
    enabled: !!shiftId,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** "1,234 m", "86.5 m". */
export function metres(n: number): string {
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: n >= 100 ? 0 : 1 })} m`;
}

/** 465 → "7:45". */
export function hoursMinutes(minutes: number): string {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
