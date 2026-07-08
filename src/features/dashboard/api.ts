import { httpClient } from "@/core/http/httpClient";
import { ApiEnvelope } from "@/core/api/types";

export interface LowStockItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
}

export interface AttendanceBreakdown {
  present: number;
  late: number;
  half_day: number;
  absent: number;
  on_leave: number;
}

export interface DashboardKpis {
  openJobs: number;
  pendingLeaves: number;
  lowStock: { count: number; items: LowStockItem[] };
  attendanceToday: {
    totalMarked: number;
    totalEmployees: number;
    unmarked: number;
    attendancePct: number;
    breakdown: AttendanceBreakdown;
  };
}

export interface Announcement {
  _id: string;
  title: string;
  body?: string;
  isPinned?: boolean;
  audience?: string;
  department?: string;
  createdAt?: string;
}

export const dashboardService = {
  async getKpis(): Promise<DashboardKpis> {
    const res = await httpClient.get<ApiEnvelope<DashboardKpis>>(
      "/dashboard/kpis"
    );
    return res.data;
  },

  async getPendingShiftCount(): Promise<number> {
    const res = await httpClient.get<{ success: boolean; count?: number; shifts?: unknown[] }>(
      "/shift/pending-verification"
    );
    return res.count ?? res.shifts?.length ?? 0;
  },

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const res = await httpClient.get<ApiEnvelope<Announcement[]>>(
      "/announcement/active"
    );
    return res.data;
  },
};
