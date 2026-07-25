import { httpClient } from "@/core/http/httpClient";

// ── Attendance ──────────────────────────────────────────────────────────
export interface AttendanceRecord {
  _id?: string;
  id?: string;
  employee?: { _id: string; name: string; department?: string } | null;
  employeeId?: string;
  name?: string;
  department?: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  workedMinutes?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  leaveType?: string;
  notes?: string;
  shift?: string;
}

export interface AttendanceDay {
  records: AttendanceRecord[];
  unmarked: Array<{ id: string; name: string; department?: string }>;
  totalMarked: number;
  totalUnmarked: number;
  breakdown: Record<string, number>;
}

export const attendanceService = {
  async byDate(date: string, shift: string): Promise<AttendanceDay> {
    const res = await httpClient.get<{ success: boolean; data: AttendanceDay }>(
      "/attendance/date",
      { date, shift }
    );
    return res.data;
  },
  mark: (body: {
    date: string;
    shift: "DAY" | "NIGHT";
    records: Array<{
      employeeId: string;
      status: string;
      lateMinutes?: number;
      overtimeMinutes?: number;
      checkIn?: string;
      checkOut?: string;
      notes?: string;
    }>;
  }) => httpClient.post("/attendance/mark", body),
  // ── Live shift timer ──
  async active(date: string): Promise<AttendanceRecord[]> {
    const res = await httpClient.get<{ success: boolean; data: AttendanceRecord[] }>(
      "/attendance/active",
      { date }
    );
    return res.data;
  },
  clockIn: (body: { employeeId: string; shift: "DAY" | "NIGHT"; date: string }) =>
    httpClient.post<{ success: boolean; data: AttendanceRecord }>("/attendance/clock-in", body),
  clockOut: (body: { employeeId: string; shift: "DAY" | "NIGHT"; date: string }) =>
    httpClient.post<{ success: boolean; data: AttendanceRecord }>("/attendance/clock-out", body),
};

// ── Payroll ─────────────────────────────────────────────────────────────
export interface PayrollEmployeeRow {
  id?: string; // payroll document id (for finalize/pay)
  employeeId: string;
  name: string;
  department: string;
  hourlyRate?: number;
  totalShifts?: number;
  presentShifts?: number;
  absentShifts?: number;
  grossEarnings?: number;
  totalDeductions?: number;
  totalBonuses?: number;
  totalAdvanceDeduction?: number;
  netPay: number;
  amountPaid?: number;
  perfectAttendance?: boolean;
  status: "draft" | "finalized" | "partially_paid" | "paid";
}

export interface PayrollDashboard {
  year: number;
  month: number;
  summary: {
    totalEmployees: number;
    totalNetPay: number;
    totalGross: number;
    totalDeductions: number;
    totalBonuses: number;
    perfectCount: number;
    paidCount: number;
    partiallyPaidCount?: number;
    finalizedCount: number;
    draftCount: number;
    totalPaid?: number;
  };
  employees: PayrollEmployeeRow[];
}

export interface AdvanceRequestRow {
  _id: string;
  employee?: { _id: string; name: string; department?: string } | null;
  amount: number;
  remainingBalance?: number | null;
  reason?: string;
  status: string;
  deductMonth?: number | null;
  deductYear?: number | null;
  createdAt?: string;
}

export interface PayrollSettings {
  casualLeavesPerMonth: number;
  sickLeavesPerMonth: number;
  lateGracePeriodMinutes: number;
  penaltyPerExcessAbsent: number;
  noLeaveBonus: number;
  perfectAttendanceBonus: number;
  streakBonusPer7Shifts: number;
  overtimeMultiplier: number;
  overtimeGraceMinutes: number;
  pfPercent: number;
  pfWageCeiling: number;
  esiPercent: number;
  esiWageCeiling: number;
}

export interface SkippedEmployee {
  employeeId: string;
  name: string;
  reason: string;
}

export const payrollService = {
  async dashboard(year: number, month: number): Promise<PayrollDashboard> {
    return httpClient.get<PayrollDashboard & { success: boolean }>("/payroll/dashboard", {
      year,
      month,
    });
  },
  generate: (year: number, month: number, employeeId?: string) =>
    httpClient.post<{ success: boolean; message: string; skipped?: SkippedEmployee[] }>("/payroll/generate", {
      year,
      month,
      employeeId,
    }),
  finalize: (id: string) =>
    httpClient.put<{ success: boolean; data: PayrollEmployeeRow }>(`/payroll/${id}/finalize`),
  // Pay the full remaining net (amount omitted) or a custom amount (partial).
  // A draft is auto-finalized on the backend before disbursing.
  pay: (
    id: string,
    body?: {
      amount?: number;
      paymentNote?: string;
      recoverAdvances?: Array<{ advance: string; amount: number }>;
    }
  ) =>
    httpClient.put<{
      success: boolean;
      cashPaid: number;
      advanceRecovered: number;
      data: { status: string; amountPaid: number; netPay: number };
    }>(`/payroll/${id}/pay`, body ?? {}),
  payOutAdvance: (id: string) => httpClient.put(`/payroll/advance/${id}/pay-out`),
  ledger: (empId: string, from: string, to: string): Promise<EmployeeLedger> =>
    httpClient.get<EmployeeLedger>(`/payroll/ledger/${empId}`, { from, to }),
  async employeeAdvances(empId: string): Promise<AdvanceRequestRow[]> {
    const res = await httpClient.get<{ success: boolean; data: AdvanceRequestRow[] }>(
      "/payroll/advance",
      { employeeId: empId }
    );
    return res.data;
  },
  async slip(empId: string, year: number, month: number): Promise<Record<string, unknown>> {
    const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> }>(
      `/payroll/slip/${empId}`,
      { year, month }
    );
    return res.data;
  },
  slipPdf: (empId: string, year: number, month: number) =>
    httpClient.getBlob(`/payroll/slip/${empId}/pdf`, { year, month }),
  async settings(): Promise<PayrollSettings> {
    const res = await httpClient.get<{ success: boolean; data: PayrollSettings }>("/payroll/settings");
    return res.data;
  },
  saveSettings: (body: Partial<PayrollSettings>) =>
    httpClient.post<{ success: boolean; data: PayrollSettings }>("/payroll/settings", body),
  async advances(status?: string): Promise<AdvanceRequestRow[]> {
    const res = await httpClient.get<{ success: boolean; data: AdvanceRequestRow[] }>(
      "/payroll/advance",
      status ? { status } : undefined
    );
    return res.data;
  },
  // Approval must say which payroll month recovers the advance — the
  // backend requires deductMonth/deductYear (calling without them 400s).
  approveAdvance: (id: string, deductMonth: number, deductYear: number) =>
    httpClient.put(`/payroll/advance/${id}/approve`, { deductMonth, deductYear }),
  rejectAdvance: (id: string) => httpClient.put(`/payroll/advance/${id}/reject`),
  // Admin/finance entry — records a given advance, born approved.
  createAdvance: (body: { employee: string; amount: number; deductMonth: number; deductYear: number; reason?: string }) =>
    httpClient.post(`/payroll/advance/admin-create`, body),
  async payrollEmployees(): Promise<Array<{ id: string; name: string; department?: string }>> {
    const res = await httpClient.get<{ success: boolean; data: Array<{ id: string; name: string; department?: string }> }>(
      "/payroll/employees"
    );
    return res.data;
  },
  async employeeOverview(empId: string, year: number, month: number): Promise<EmployeeOverview> {
    const res = await httpClient.get<{ success: boolean; data: EmployeeOverview }>(
      `/payroll/employee-overview/${empId}`,
      { year, month }
    );
    return res.data;
  },
  async history(empId: string, limit = 6): Promise<PayrollHistory> {
    const res = await httpClient.get<{ success: boolean; data: PayrollHistory }>(
      `/payroll/history/${empId}`,
      { limit }
    );
    return res.data;
  },
  // One employee's slips across a month window, oldest first, plus totals.
  range: (empId: string, r: MonthRange): Promise<PayrollRange> =>
    httpClient.get<PayrollRange>(`/payroll/range/${empId}`, { ...r }),
  // Per-employee summed rows across a month window (payroll page range view).
  dashboardRange: (r: MonthRange): Promise<PayrollRangeDashboard> =>
    httpClient.get<PayrollRangeDashboard>("/payroll/dashboard-range", { ...r }),
};

export type LedgerKind =
  | "shift_salary" | "overtime" | "bonus" | "diwali_bonus" | "penalty"
  | "absence" | "statutory" | "advance_issued" | "advance_recovered"
  | "payment" | "adjustment";

export interface LedgerRow {
  _id: string;
  date: string;
  kind: LedgerKind;
  amount: number;      // +ve = owed to employee, -ve = reduces what's owed
  label: string;
  balance: number;     // running balance after this row
  year?: number | null;
  month?: number | null;
  source: string;
}

export interface EmployeeLedger {
  success: boolean;
  employee: { id: string; name: string; department?: string } | null;
  range: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
  entries: LedgerRow[];
  totals: {
    earnings: number; bonuses: number; penalties: number;
    statutory: number; advances: number; payments: number;
  };
}

export interface MonthRange {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}

export interface PayrollRangeSlip {
  _id: string;
  year: number;
  month: number;
  netPay: number;
  grossEarnings?: number;
  totalBonuses?: number;
  totalDeductions?: number;
  totalAdvanceDeduction?: number;
  amountPaid?: number;
  status: string;
}
export interface PayrollRange {
  success: boolean;
  range: MonthRange;
  slips: PayrollRangeSlip[];
  totals: {
    months: number;
    grossEarnings: number;
    totalBonuses: number;
    totalDeductions: number;
    totalAdvanceDeduction: number;
    netPay: number;
    amountPaid: number;
  };
}

export interface PayrollRangeRow {
  employeeId: string;
  name: string;
  department: string;
  grossEarnings: number;
  totalDeductions: number;
  totalBonuses: number;
  totalAdvanceDeduction: number;
  netPay: number;
  amountPaid: number;
  months: number;
  paidMonths: number;
  fullyPaid: boolean;
}
export interface PayrollRangeDashboard {
  success: boolean;
  range: MonthRange;
  summary: {
    totalEmployees: number;
    totalNetPay: number;
    totalGross: number;
    totalDeductions: number;
    totalBonuses: number;
    totalPaid: number;
  };
  employees: PayrollRangeRow[];
}

export interface PayslipRow {
  _id: string;
  year: number;
  month: number;
  netPay: number;
  grossEarnings?: number;
  totalDeductions?: number;
  status: string; // draft | finalized | paid
  finalizedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
}
export interface PayrollHistory {
  payslips: PayslipRow[];
  unpaidTotal: number;
  unpaidCount: number;
}

export interface EmployeeOverview {
  employee: { id: string; name: string; department?: string; role?: string; hourlyRate: number };
  shiftRates: { DAY: number; NIGHT: number };
  period: { year: number; month: number };
  payroll: {
    grossEarnings: number;
    totalDeductions: number;
    totalBonuses: number;
    netPay: number;
    presentShifts: number;
    absentShifts: number;
    halfDayShifts: number;
    approvedLeaveShifts: number;
    totalLateMinutes: number;
    totalShifts: number;
    dayShiftsWorked: number;
    nightShiftsWorked: number;
    totalAdvanceDeduction: number;
    overtimeEarnings?: number;
    totalOvertimeMinutes?: number;
    pfDeduction?: number;
    esiDeduction?: number;
    status: string;
  };
  production: { totalMeters: number; shifts: number };
  wastage: {
    entries: Array<{ _id: string; reason?: string; penalty?: number; meters?: number; createdAt?: string }>;
    totalPenalty: number;
  };
}

// ── Bonus ───────────────────────────────────────────────────────────────
export interface BonusConfig {
  year: number;
  yearlyWorkingDays?: number;
  defaultPercent?: number;
  status?: string;
  bonusDate?: string | null;
  bonusLabel?: string;
  minDaysForEligibility?: number;
  minBonusPercent?: number;
}

export interface BonusRecordRow {
  _id: string;
  employee?: { _id: string; name: string; department?: string } | null;
  year: number;
  daysWorked?: number;
  percent?: number;
  bonusAmount: number;
  status: string;
}

export const bonusService = {
  async config(year: number): Promise<{
    config: BonusConfig;
    stats: { totalRecords: number; paidRecords: number; pendingRecords: number; totalPayout: number };
  }> {
    return httpClient.get("/bonus/config", { year });
  },
  async records(year: number): Promise<BonusRecordRow[]> {
    const res = await httpClient.get<{ success: boolean; records?: BonusRecordRow[]; data?: BonusRecordRow[] }>(
      "/bonus/records",
      { year }
    );
    return res.records ?? res.data ?? [];
  },
  trigger: (year: number) => httpClient.post("/bonus/trigger", { year }),
  saveConfig: (body: {
    year: number;
    bonusDate?: string;
    bonusLabel?: string;
    yearlyWorkingDays?: number;
    minDaysForEligibility?: number;
    minBonusPercent?: number;
  }) => httpClient.put<{ success: boolean; config: BonusConfig }>("/bonus/config", body),
  payRecord: (id: string) => httpClient.put(`/bonus/records/${id}/pay`),
  preview: (year: number) => httpClient.get<BonusPreview>("/bonus/preview", { year }),
  // Live projection for one employee (employee detail page).
  prediction: (empId: string, year: number) =>
    httpClient.get<BonusPrediction>(`/bonus/employee/${empId}/prediction`, { year }),
};

export interface BonusPrediction {
  success: boolean;
  year: number;
  employee: { id: string; name: string; department?: string };
  approximate: boolean;
  configured: boolean;
  diwaliDate: string | null;
  bonusLabel: string;
  window: { start: string; end: string };
  prediction: BonusPreviewRow & { rawBonusAmount?: number; salaryReceived?: number };
  record: { bonusAmount: number; status: string; paidAt?: string | null } | null;
}

export interface BonusPreviewRow {
  employeeId: string;
  name: string;
  department: string;
  salaryReceived: number;
  annualEarnings: number;
  bonusPercent: number;
  attendanceRate: number;
  attendanceTier: string;
  multiplier: number;
  bonusAmount: number;
  basedOn: string;
  attendanceSource?: string;
  attendanceDays?: number;
  totalWorkingDays?: number;
  eligible?: boolean;
  minDaysForEligibility?: number;
}

export interface BonusPreview {
  success: boolean;
  year: number;
  approximate: boolean;
  canGenerate: boolean;
  configured?: boolean;
  diwaliDate: string | null;
  bonusLabel: string;
  totalPayout: number;
  eligibleCount?: number;
  ineligibleCount?: number;
  config?: BonusConfig;
  rows: BonusPreviewRow[];
  window: { start: string; end: string };
}

// ── Leave ───────────────────────────────────────────────────────────────
export interface LeaveRow {
  _id?: string;
  id?: string;
  employee?: { _id: string; name: string; department?: string } | null;
  date?: string;
  toDate?: string;
  reason?: string;
  type?: string;
  status: string;
  createdAt?: string;
}

export interface LeaveCreateInput {
  employeeId: string;
  date: string;
  shift: "DAY" | "NIGHT" | "BOTH";
  leaveType: "casual" | "sick" | "unpaid";
  reason: string;
  autoApprove?: boolean;
}

export interface EmployeeLeaveRow {
  id: string;
  date?: string;
  dateLabel?: string;
  shift?: string;
  leaveType?: string;
  reason?: string;
  status: string; // pending | approved | rejected
  createdAt?: string;
}

export const leaveService = {
  async pending(): Promise<LeaveRow[]> {
    const res = await httpClient.get<{ success: boolean; data: LeaveRow[] }>("/leave/pending");
    return res.data;
  },
  async byEmployee(empId: string): Promise<EmployeeLeaveRow[]> {
    const res = await httpClient.get<{ success: boolean; data: EmployeeLeaveRow[] }>(
      `/leave/employee/${empId}`
    );
    return res.data;
  },
  approve: (id: string, note?: string) => httpClient.put(`/leave/${id}/approve`, { note }),
  reject: (id: string, note?: string) => httpClient.put(`/leave/${id}/reject`, { note }),
  // Admin raises leave on an employee's behalf; autoApprove creates it
  // already approved (and syncs attendance).
  create: (body: LeaveCreateInput) => httpClient.post("/leave/admin-request", body),
};
