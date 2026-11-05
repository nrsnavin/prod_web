import type { RemarkClass } from "@/features/shifts/remark";

// ══════════════════════════════════════════════════════════════════
//  THE FLOOR-ENTRY SCREEN — what the server says (api/floor.js)
// ══════════════════════════════════════════════════════════════════

export type Shift = "DAY" | "NIGHT";

/** What the floor can do on a loom this shift. */
export type EntryState = "free" | "loading" | "unplanned" | "ready" | "entered" | "verified" | "locked";

export interface FloorSession {
  dateKey: string;
  shift: Shift;
  name: string;
}

export interface HeadSlot {
  head: number;
  elastic: { id: string; name: string | null } | null;
}

export interface Submitted {
  production: number | null;
  timer: string | null;
  feedback: string;
  at: string | null;
  byName: string;
}

export interface FloorDetail {
  id: string;
  status: string;
  operator: { id: string; name: string | null } | null;
  /** The office put this operator on the loom; the floor cannot change it. */
  operatorLocked?: boolean;
  submitted: Submitted | null;
}

export interface FloorMachine {
  id: string;
  ID: string;
  manufacturer: string;
  hooks: number | null;
  heads: number | null;
  headsRunning: number;
  status: "free" | "running" | "maintenance";
  loading: boolean;
  job: { id: string; no: string; status: string } | null;
  headMap: HeadSlot[];
  detail: FloorDetail | null;
  entry: EntryState;
  why: string | null;
  /** What a head of this loom weaves an hour, learned from its own verified shifts (or the plant's, `basis`). */
  rate?: { metresPerHeadHour: number; basis: "machine" | "plant"; shifts: number; pick: number } | null;
  /** The loom's own sensor: what it ran on this shift so far. */
  sensor?: { runTime: string; seconds: number; lastAt: string; complete: boolean; live: boolean } | null;
}

export interface FloorOperator {
  id: string;
  name: string;
  department: string;
}

/** A loom that stood free the shift the floor finished entering. */
export interface FreeMachine {
  id: string;
  ID: string;
  why: string;
}

/** The supervisor pressed Create shift plan: the looms noted became the plan. */
export interface FloorCompletion {
  completedAt: string;
  completedBy: string;
  freeMachines: FreeMachine[];
  /** Looms being loaded that shift, and who loaded them. */
  loadingMachines: { id: string; ID: string; operatorName: string }[];
}

export interface FloorPlan {
  id: string;
  status: string;
  finalized: boolean;
  description: string;
  /** Made from the floor (operators are the floor's to change), not in the office. */
  fromFloor: boolean;
  floor: FloorCompletion | null;
}

export interface FloorState {
  dateKey: string;
  shift: Shift;
  label: string;
  isCurrent: boolean;
  plan: FloorPlan | null;
  machines: FloorMachine[];
  operators: FloorOperator[];
  counts: { total: number; toEnter: number; entered: number } & Partial<Record<EntryState, number>>;
}

/** What saving an entry gives back: the loom, and the plan as it now stands. */
export interface EntrySaved {
  machine: FloorMachine;
  plan: FloorPlan | null;
  /** Verified by the rule: the photo and the loom's own rate agreed. */
  autoVerified?: boolean;
  /** Why it waits for the office, when it was not. */
  waitsBecause?: string[];
  /** The remark, classed; a fault is offered to the fitter. */
  remark?: RemarkClass | null;
}

/** The remark raised as a machine issue, or the open one it repeats. */
export interface RemarkIssue {
  issue: { id: string; title: string; severity: string; status: string };
  duplicate: boolean;
  already: boolean;
}

/** What Create shift plan gives back. */
export interface CompleteResult {
  plan: FloorPlan;
  entered: number;
  /** Looms created without, when the supervisor said to go ahead anyway. */
  toEnter: string[];
  freeMachines: FreeMachine[];
}

/** The loom's timer photo from the shift before, shown beside the camera. */
export interface PreviousTimerPhoto {
  shift: { dateKey: string; shift: Shift; label: string };
  operator: string | null;
  /** The verified run time once the office signed it off, else what the floor submitted. */
  runTime: string | null;
  verified?: boolean;
  entryId?: string | null;
  photo: {
    id: string;
    takenAt: string;
    byName: string;
    readText: string | null;
    readKind?: string | null;
    runTimeUsed: string | null;
    used: boolean;
    /** Where a total-hours meter stood when that shift ended; this shift starts from it. */
    meterHours?: number | null;
    /** A metre counter on the panel, where it stood when that shift ended. */
    counterMetres?: number | null;
  } | null;
}

export interface EntryInput {
  detailId: string;
  production: number;
  timer?: string | null;
  feedback?: string;
  operator?: string | null;
}
