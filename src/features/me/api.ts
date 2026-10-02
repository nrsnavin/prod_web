import { httpClient } from "@/core/http/httpClient";
import { config } from "@/app/config";
import {
  ElasticSpec, LeaveApplication, MyAttendanceMonth, MyLeave, MyPayslip, MyPerformance, MyProfile, MyShift, MyWastage,
} from "./types";

// The employee view's reads. /me routes take the worker from the login;
// the older self-service routes take their employee id, which the server
// checks against the login (selfOrAdmin) — so passing anyone else's id
// is refused there, not here.
export const meService = {
  async today(): Promise<MyShift[]> {
    return (await httpClient.get<{ shifts: MyShift[] }>("/me/today")).shifts;
  },
  performance(days = 90): Promise<MyPerformance> {
    return httpClient.get<MyPerformance>("/me/shifts", { days });
  },
  async elastic(id: string): Promise<ElasticSpec> {
    return (await httpClient.get<{ elastic: ElasticSpec }>(`/me/elastic/${id}`)).elastic;
  },
  async profile(): Promise<MyProfile> {
    return (await httpClient.get<{ profile: MyProfile }>("/me/profile")).profile;
  },
  submitProduction(shiftId: string, body: { production: number; timer?: string; feedback?: string }) {
    return httpClient.post<{ success: boolean }>(`/me/shifts/${shiftId}/production`, body);
  },

  async wastage(employeeId: string): Promise<MyWastage[]> {
    return (await httpClient.get<{ wastage: MyWastage[] }>("/wastage/get-by-employee", { id: employeeId })).wastage;
  },
  attendanceMonth(employeeId: string, year: number, month: number): Promise<MyAttendanceMonth> {
    return httpClient.get<MyAttendanceMonth>(`/attendance/monthly/${employeeId}`, { year, month });
  },
  async leaves(employeeId: string): Promise<MyLeave[]> {
    return (await httpClient.get<{ data: MyLeave[] }>(`/leave/employee/${employeeId}`)).data;
  },
  /** Always for the signed-in worker: the server takes them from the login. */
  applyLeave(body: LeaveApplication) {
    return httpClient.post<{ success: boolean; data: MyLeave }>("/leave/request", body);
  },
  /** Only a pending request of the worker's own; the server checks both. */
  cancelLeave(id: string) {
    return httpClient.delete<{ success: boolean }>(`/leave/${encodeURIComponent(id)}`);
  },
  /** null when the month's payslip has not been generated yet. */
  async payslip(employeeId: string, year: number, month: number): Promise<MyPayslip | null> {
    try {
      return (await httpClient.get<{ data: MyPayslip }>(`/payroll/slip/${employeeId}`, { year, month })).data;
    } catch (e) {
      if ((e as { status?: number })?.status === 404) return null;
      throw e;
    }
  },
  payslipPdfUrl(employeeId: string, year: number, month: number): string {
    return `${config.apiBaseUrl}/payroll/slip/${employeeId}/pdf?year=${year}&month=${month}`;
  },
};
