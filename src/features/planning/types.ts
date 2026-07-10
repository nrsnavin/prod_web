// Mirrors GET /api/v2/planner/suggest-plan (prod/api/planner.js)

export type RateSource = "posterior" | "plant" | "coldstart";

export interface PlanRow {
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
  onTime: number;
  late: number;
  totalLateDays: number;
  changeovers: number;
  machinesUsed: number;
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
  objective: PlanObjective;
  machines: MachinePlan[];
  unplaceable: UnplaceableLine[];
  assumptions: string[];
  aiRationale: string | null;
  aiGenerated: boolean;
}

export interface AcceptedPlan {
  _id: string;
  horizonDays: number;
  generatedAt: string;
  acceptedAt: string;
  acceptedBy: string;
  objective: PlanObjective;
  assignments: Array<{
    machineID: string;
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
