// Shapes of /api/v2/me (see api/me.js on the server) and of the existing
// self-service routes the employee view reads.

export interface MaterialRef {
  name: string;
  category?: string;
}

export interface ElasticSpec {
  id: string;
  name: string;
  weaveType: string;
  image: string | null;
  spandexEnds: number;
  yarnEnds: number | null;
  pick: number;
  hooks: number;
  weightPerMetre: number;
  warpSpandex: { material: MaterialRef | null; ends: number | null; weight: number | null } | null;
  warpYarn: Array<{ material: MaterialRef | null; ends: number | null; type: string | null; weight: number | null }>;
  spandexCovering: { material: MaterialRef | null; weight: number | null } | null;
  weftYarn: { material: MaterialRef | null; weight: number | null } | null;
  testing: { width: number | null; elongation: number | null; recovery: number | null; stretch: string | null } | null;
  warpingPlan: {
    noOfBeams?: number;
    beams?: Array<{ beamNo?: number; totalEnds?: number; sections?: Array<{ ends?: number; maxMeters?: number }> }>;
  } | null;
}

export type MyShiftStatus = "open" | "pending_verification";

export interface MyShift {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  status: MyShiftStatus;
  description: string;
  submitted: { production: number | null; timer: string | null; feedback: string; at: string | null } | null;
  machine: { id: string; code: string; heads: number; status: string; manufacturer: string | null } | null;
  heads: Array<{ head: number; elastic: ElasticSpec | null }>;
  job: {
    id: string;
    jobNo: number;
    status: string;
    orderNo: number | null;
    supplyDate: string | null;
    elastics: Array<{ elastic: string; planned: number; produced: number }>;
  } | null;
}

export interface MyShiftHistoryRow {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  machine: string | null;
  elastics: string[];
  metres: number;
  runHours: number | null;
  metresPerHour: number | null;
}

export interface MyPerformance {
  days: number;
  summary: {
    shifts: number;
    totalMetres: number;
    avgPerShift: number | null;
    metresPerHour: number | null;
    plantAvgPerShift: number | null;
    previousAvgPerShift: number | null;
    changePct: number | null;
  };
  shifts: MyShiftHistoryRow[];
}

export interface MyProfile {
  employeeId: string;
  name: string;
  department: string | null;
  role: string | null;
  skill: number | null;
  yearsOfExperience: number | null;
  machineType: string | null;
  phoneNumber: string | null;
  email: string | null;
  since: string | null;
}

export interface MyWastage {
  _id: string;
  quantity: number;
  penalty?: number;
  reason?: string;
  incidentDate?: string;
  createdAt: string;
  elastic?: { name: string } | null;
  job?: { jobOrderNo: number } | null;
}

export interface MyAttendanceMonth {
  year: number;
  month: number;
  stats: { present: number; late: number; halfDay: number; absent: number; onLeave: number; totalLateMin: number };
}

export interface MyLeave {
  id: string;
  date: string;
  dateLabel: string;
  shift: string;
  leaveType: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | string;
  reviewNotes?: string;
}

export interface MyPayslip {
  year: number;
  month: number;
  presentShifts: number;
  absentShifts: number;
  grossEarnings: number;
  totalDeductions: number;
  totalBonuses: number;
  netPay: number;
  totalAdvanceDeduction: number;
  paid?: boolean;
  status?: string;
}
