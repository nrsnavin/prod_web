import { httpClient } from "@/core/http/httpClient";
import {
  Employee,
  EmployeeDetail,
  EmployeeFormValues,
  EmployeeStatusFilter,
  OffboardReason,
  OffboardResult,
} from "./types";

export const employeeService = {
  async list(department: string, status: EmployeeStatusFilter = "active"): Promise<Employee[]> {
    const params: Record<string, string> = {};
    if (department && department !== "all") params.department = department;
    if (status !== "active") params.status = status;
    const res = await httpClient.get<{ success: boolean; employees: Employee[] }>(
      "/employee/get-employees",
      Object.keys(params).length ? params : undefined
    );
    return res.employees;
  },

  /** Someone leaves: their last working day and why. Their records stay. */
  offboard(id: string, body: { lastWorkingDay: string; reason: OffboardReason; note?: string }) {
    return httpClient.post<OffboardResult>(`/employee/${encodeURIComponent(id)}/offboard`, body);
  },

  /** Rehired: active again, with the record of having left kept. */
  reinstate(id: string, note?: string) {
    return httpClient.post<{ success: boolean }>(`/employee/${encodeURIComponent(id)}/reinstate`, { note });
  },

  async getById(id: string): Promise<EmployeeDetail> {
    const res = await httpClient.get<{ success: boolean; employee: EmployeeDetail }>(
      "/employee/get-employee-detail",
      { id }
    );
    return res.employee;
  },

  async create(body: EmployeeFormValues): Promise<Employee> {
    const res = await httpClient.post<{ success: boolean; employee: Employee }>(
      "/employee/create-employee",
      body
    );
    return res.employee;
  },

  async update(id: string, body: Partial<EmployeeFormValues> & { skill?: number; expectedVersion?: number }): Promise<Employee> {
    const res = await httpClient.put<{ success: boolean; employee: Employee }>(
      `/employee/update?id=${encodeURIComponent(id)}`,
      body
    );
    return res.employee;
  },

  /** The full Aadhaar number: admins only, and every look is recorded. */
  async revealAadhaar(id: string): Promise<string | null> {
    const res = await httpClient.get<{ success: boolean; aadhar: string | null }>("/employee/aadhaar", { id });
    return res.aadhar;
  },

  async setPerformance(id: string, performance: number): Promise<void> {
    await httpClient.patch("/employee/performance", { id, performance });
  },

  async attendance(
    id: string,
    startDate: string,
    endDate: string,
    shift: string = "all"
  ): Promise<AttendanceReport> {
    const res = await httpClient.get<{ success: boolean } & AttendanceReport>(
      `/attendance/employee/${encodeURIComponent(id)}`,
      { startDate, endDate, shift }
    );
    return { summary: res.summary, records: res.records };
  },
};

export interface AttendanceRecord {
  id: string;
  date: string;
  dateLabel: string;
  dayOfWeek: string;
  shift: string;
  status: string;
  checkIn: string;
  checkOut: string;
  lateMinutes: number;
  leaveType: string;
  notes: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  attendancePct: number;
  totalLateMinutes: number;
}

export interface AttendanceReport {
  summary: AttendanceSummary;
  records: AttendanceRecord[];
}
