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

/** Every running loom entered on a plan made from the floor: the draft is complete. */
export interface FloorCompletion {
  completedAt: string;
  completedBy: string;
  freeMachines: FreeMachine[];
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

/** What saving an entry gives back: the loom, the plan, and the completion when this was the last loom. */
export interface EntrySaved {
  machine: FloorMachine;
  plan: FloorPlan | null;
  shiftComplete: (FloorCompletion & { entered: number }) | null;
}

export interface EntryInput {
  detailId: string;
  production: number;
  timer?: string | null;
  feedback?: string;
  operator?: string | null;
}
