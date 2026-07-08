import { httpClient } from "@/core/http/httpClient";
import {
  PendingShift,
  ProductionDay,
  RunningMachineOption,
  ShiftPlanDetail,
  ShiftPlanFormValues,
  TodayShiftSummary,
} from "./types";

export const shiftService = {
  async today(): Promise<{ dayShift: TodayShiftSummary; nightShift: TodayShiftSummary }> {
    const res = await httpClient.get<{
      success: boolean;
      data: { dayShift: TodayShiftSummary; nightShift: TodayShiftSummary };
    }>("/shift/today");
    return res.data;
  },

  async planById(id: string): Promise<ShiftPlanDetail> {
    const res = await httpClient.get<{ success: boolean; data: ShiftPlanDetail }>(
      "/shift/shiftPlanById",
      { id }
    );
    return res.data;
  },

  async plansOnDate(dateIso: string): Promise<Array<{ _id: string; shift: "DAY" | "NIGHT"; date: string }>> {
    const res = await httpClient.get<{
      success: boolean;
      shifts: Array<{ _id: string; shift: "DAY" | "NIGHT"; date: string }>;
    }>("/shift/shiftPlanToday", { date: dateIso });
    return res.shifts;
  },

  createPlan: (body: ShiftPlanFormValues) => httpClient.post("/shift/create-shift-plan", body),
  deletePlan: (id: string) => httpClient.delete("/shift/deletePlan", { id }),

  async pendingVerification(): Promise<{ count: number; shifts: PendingShift[] }> {
    const res = await httpClient.get<{
      success: boolean;
      count: number;
      shifts: PendingShift[];
    }>("/shift/pending-verification");
    return res;
  },

  verifyProduction: (body: {
    shiftId: string;
    productionMeters: number;
    timer?: string;
    feedback?: string;
    note?: string;
  }) => httpClient.post("/shift/verify-production", body),

  async runningMachines(): Promise<RunningMachineOption[]> {
    const res = await httpClient.get<{ success: boolean; data: RunningMachineOption[] }>(
      "/machine/running-machines"
    );
    return res.data;
  },

  async weavingEmployees(): Promise<Array<{ _id: string; name: string }>> {
    const res = await httpClient.get<{
      success: boolean;
      employees: Array<{ _id: string; name: string }>;
    }>("/employee/get-employee-weave");
    return res.employees;
  },
};

export const productionService = {
  async dateRange(startDate: string, endDate: string): Promise<ProductionDay[]> {
    const res = await httpClient.get<{ success: boolean; count: number; data: ProductionDay[] }>(
      "/production/date-range",
      { startDate, endDate }
    );
    return res.data;
  },

  async shiftDetail(shiftPlanId: string): Promise<{
    shiftPlanId: string;
    dateLabel: string;
    shift: "DAY" | "NIGHT";
    description?: string;
    totalProduction: number;
    summary: {
      totalMachines: number;
      totalOperators: number;
      totalProduction: number;
      timerLabel: string;
      avgProductionPerMachine: number;
      statusCounts: Record<string, number>;
    };
    details: Array<{
      shiftDetailId: string;
      status: string;
      timer: string;
      timerLabel: string;
      productionMeters: number;
      machine?: { machineID?: string } | null;
      employee?: { name?: string; department?: string } | null;
      job?: { jobNo?: number; status?: string } | null;
    }>;
  }> {
    const res = await httpClient.get<{ success: boolean; data: never }>(
      `/production/shift-detail/${shiftPlanId}`
    );
    return res.data;
  },
};
