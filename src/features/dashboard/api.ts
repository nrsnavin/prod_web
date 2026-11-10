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
  /** Live orders past their supply date. Absent from an older API. */
  lateOrders?: number;
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
  /** Tamil and Hindi, for the employee app (admin view). */
  translations?: Partial<Record<"ta" | "hi", { title: string; body: string; by?: "ai" | "person" }>>;
}

/** One thing waiting on someone, with up to three examples. */
export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  tone: "warning" | "danger";
  /** The screen that clears it. */
  to: string;
  summary?: string;
  items: Array<{ title: string; detail: string; to: string }>;
}

export interface DashboardOverview {
  role: "owner" | "production" | "accounts";
  generatedAt: string;
  attention: AttentionItem[];
  ordersAtRisk: { count: number; late: number; top: { orderNo: number; orderId: string; detail: string } | null };
  money?: {
    receivable: { total: number; overdue: number; overdueDocs: number; docs: number };
    payable: { total: number; dueThisWeek: number; dueThisWeekDocs: number };
    sales: { monthToDate: number; invoices: number; lastMonthSameDays: number; throughDay: number };
  };
  floor?: {
    looms: { total: number; running: number; loading: number; maintenance: number };
    metres: {
      today: number;
      /** Null until a working day has been recorded. */
      perWorkingDay: number | null;
      previousPerWorkingDay: number | null;
      days: number;
      previousDays: number;
      series: Array<{ date: string; metres: number }>;
    };
  };
}

export const dashboardService = {
  /** The home screen by role: attention, money, floor (services/dashboardOverview.js). */
  async getOverview(): Promise<DashboardOverview> {
    const res = await httpClient.get<ApiEnvelope<DashboardOverview>>("/dashboard/overview");
    return res.data;
  },

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
