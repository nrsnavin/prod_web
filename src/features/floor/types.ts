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

export interface FloorState {
  dateKey: string;
  shift: Shift;
  label: string;
  isCurrent: boolean;
  plan: { id: string; status: string; finalized: boolean; description: string } | null;
  machines: FloorMachine[];
  operators: FloorOperator[];
  counts: { total: number; toEnter: number; entered: number } & Partial<Record<EntryState, number>>;
}

export interface EntryInput {
  detailId: string;
  production: number;
  timer?: string | null;
  feedback?: string;
  operator?: string | null;
}
