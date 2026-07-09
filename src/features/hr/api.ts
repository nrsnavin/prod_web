import { httpClient } from "@/core/http/httpClient";

// ── Attendance ──────────────────────────────────────────────────────────
export interface AttendanceRecord {
  _id?: string;
  id?: string;
  employee?: { _id: string; name: string; department?: string } | null;
  name?: string;
  department?: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
  lateMinutes?: number;
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
    records: Array<{ employeeId: string; status: string; lateMinutes?: number; notes?: string }>;
  }) => httpClient.post("/attendance/mark", body),
};

// ── Payroll ─────────────────────────────────────────────────────────────
export interface PayrollEmployeeRow {
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
  perfectAttendance?: boolean;
  status: "draft" | "finalized" | "paid";
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
    finalizedCount: number;
    draftCount: number;
  };
  employees: PayrollEmployeeRow[];
}

export interface AdvanceRequestRow {
  _id: string;
  employee?: { _id: string; name: string; department?: string } | null;
  amount: number;
  reason?: string;
  status: string;
  createdAt?: string;
}

export const payrollService = {
  async dashboard(year: number, month: number): Promise<PayrollDashboard> {
    return httpClient.get<PayrollDashboard & { success: boolean }>("/payroll/dashboard", {
      year,
      month,
    });
  },
  generate: (year: number, month: number, employeeId?: string) =>
    httpClient.post<{ success: boolean; message: string }>("/payroll/generate", {
      year,
      month,
      employeeId,
    }),
  async slip(empId: string, year: number, month: number): Promise<Record<string, unknown>> {
    const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> }>(
      `/payroll/slip/${empId}`,
      { year, month }
    );
    return res.data;
  },
  async advances(status?: string): Promise<AdvanceRequestRow[]> {
    const res = await httpClient.get<{ success: boolean; data: AdvanceRequestRow[] }>(
      "/payroll/advance",
      status ? { status } : undefined
    );
    return res.data;
  },
  approveAdvance: (id: string) => httpClient.put(`/payroll/advance/${id}/approve`),
  rejectAdvance: (id: string) => httpClient.put(`/payroll/advance/${id}/reject`),
};

// ── Bonus ───────────────────────────────────────────────────────────────
export interface BonusConfig {
  year: number;
  yearlyWorkingDays?: number;
  defaultPercent?: number;
  status?: string;
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
  payRecord: (id: string) => httpClient.put(`/bonus/records/${id}/pay`),
};

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

export const leaveService = {
  async pending(): Promise<LeaveRow[]> {
    const res = await httpClient.get<{ success: boolean; data: LeaveRow[] }>("/leave/pending");
    return res.data;
  },
  approve: (id: string, note?: string) => httpClient.put(`/leave/${id}/approve`, { note }),
  reject: (id: string, note?: string) => httpClient.put(`/leave/${id}/reject`, { note }),
};
