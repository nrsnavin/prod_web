// Mirrors GET /api/v2/planner/suggest-plan (prod/api/planner.js)

export type RateSource = "posterior" | "plant" | "coldstart";

export interface PlanRow {
  /** The optimiser's key for this line. Needed to move a row to another
   *  machine and to match an edited plan back against the proposal. */
  lineId: string;
  orderId: string;
  orderNo: number;
  customer: string;
  elasticId: string;
  elasticName: string;
  qtyMeters: number;
  heads: number;
  sequence: number;
  weavingDays: number;
  startWorkingDay: number;
  projectedFinish: string | null;
  dueDate: string | null;
  late: boolean;
  lateWorkingDays: number;
  changeover: boolean;
  rateSource: RateSource;
}

export interface MachinePlan {
  machineId: string;
  machineID: string;
  heads: number;
  changeovers: number;
  rows: PlanRow[];
}

export interface PlanObjective {
  lines: number;
  placed: number;
  unplaceable: number;
  /** Lines left out because they fall due after the horizon ends.
   *  `lines` counts only what the horizon admits, so without this a
   *  narrower horizon looks like work vanishing. */
  beyondHorizon: number;
  onTime: number;
  late: number;
  totalLateDays: number;
  changeovers: number;
  machinesUsed: number;
}

/** A loom that is still finishing what is already on it. */
export interface CommittedMachine {
  machineId: string;
  machineID: string;
  committedWorkingDays: number;
  freeFrom: string | null;
}

export interface UnplaceableLine {
  orderId: string;
  orderNo: number;
  customer: string;
  elasticName: string;
  qtyMeters: number;
  dueDate: string | null;
  reason: string;
}

export interface SuggestedPlan {
  success: boolean;
  generatedAt: string;
  horizonDays: number;
  /** The last due date the horizon admits (YYYY-MM-DD). */
  horizonEnd: string | null;
  objective: PlanObjective;
  committed: CommittedMachine[];
  machines: MachinePlan[];
  unplaceable: UnplaceableLine[];
  assumptions: string[];
  aiRationale: string | null;
  aiGenerated: boolean;
  aiSuggestionId?: string | null;
  /** The objective this plan was scored under, and whether it is the
   *  learned one yet. */
  weights: PlannerWeights;
  /** The three terms the objective is built from, for this plan. */
  objectiveTerms: ObjectiveTerms;
}

export interface ObjectiveTerms {
  late: number;
  changeover: number;
  balance: number;
}

export interface PlannerWeights extends ObjectiveTerms {
  /** False while the planner is still on the defaults. "Learned" and
   *  "has not seen enough corrections yet" are different claims. */
  learned: boolean;
  observations: number;
  needed: number;
}

export interface WeightUpdate {
  at: string;
  actor: string;
  lines: number;
  proposed: ObjectiveTerms;
  accepted: ObjectiveTerms;
  weights: ObjectiveTerms;
  note: string;
}

export interface WeightsReport {
  /** What the optimiser is actually running on. */
  active: ObjectiveTerms;
  learned: boolean;
  /** What has been learned so far — differs from `active` during warm-up. */
  stored: ObjectiveTerms;
  defaults: ObjectiveTerms;
  bounds: { changeover: { min: number; max: number }; balance: { min: number; max: number } };
  observations: number;
  needed: number;
  learningRate: number;
  lastResetAt: string | null;
  lastResetBy: string;
  history: WeightUpdate[];
}

/** What POST /planner/accept took from the acceptance. */
export interface LearningResult {
  updated: boolean;
  reason?: string;
  note?: string;
  observations?: number;
  inUse?: boolean;
  before?: ObjectiveTerms;
  after?: ObjectiveTerms;
}

export interface AcceptedPlan {
  _id: string;
  horizonDays: number;
  generatedAt: string;
  acceptedAt: string;
  acceptedBy: string;
  objective: PlanObjective;
  edited: boolean;
  proposedTerms?: ObjectiveTerms;
  objectiveTerms?: ObjectiveTerms;
  assignments: Array<{
    machineID: string;
    startWorkingDay: number;
    heads: number;
    elasticName: string;
    orderNo: number;
    customer: string;
    qtyMeters: number;
    sequence: number;
    weavingDays: number;
    projectedFinish: string | null;
    dueDate: string | null;
    late: boolean;
    lateWorkingDays: number;
    changeover: boolean;
    rateSource: RateSource;
  }>;
  assumptions: string[];
  status: "accepted" | "superseded";
}
