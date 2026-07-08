// Mirrors GET /api/v2/production/analytics response (see prod/api/production.js)

export interface AnalyticsSummary {
  totalProduction: number;
  activeShifts: number;
  activeMachines: number;
  activeEmployees: number;
  avgPerShift: number;
  overallAvg: number;
  anomalyCount: number;
  totalRunMinutes: number;
  avgEfficiencyScore: number;
  factoryConsistency: number;
  dayVsNight: { day: number; night: number };
}

export interface TrendPoint {
  date: string;
  dateLabel: string;
  dayOfWeek: string;
  production: number;
  machines: number;
  operators: number;
}

export interface WeeklyPatternPoint {
  dayIndex: number;
  dayName: string;
  avgProduction: number;
  shiftCount: number;
}

export interface MachineStat {
  machineId: string;
  machineNo: string | number;
  manufacturer: string;
  noOfHeads: number;
  isActive: boolean;
  totalProduction: number;
  shiftCount: number;
  avgPerShift: number;
  efficiencyPerHead: number;
  consistencyScore: number;
  improvement: number;
  bestShift: number;
  worstShift: number;
  trendDirection: "up" | "down" | "stable";
  totalRunMinutes: number;
  utilizationPct: number;
}

export interface EmployeeStat {
  employeeId: string;
  name: string;
  department: string;
  skill: string;
  role: string;
  totalProduction: number;
  shiftCount: number;
  avgPerShift: number;
  consistencyScore: number;
  improvement: number;
  bestShift: number;
  worstShift: number;
  trendDirection: "up" | "down" | "stable";
  totalRunMinutes: number;
  anomalyCount: number;
}

export type AnomalySeverity = "high" | "medium" | "low";

export interface Anomaly {
  type: string;
  severity: AnomalySeverity;
  date: string;
  dateLabel: string;
  entityType: "machine" | "employee";
  entityId: string;
  entityName: string;
  value: number;
  threshold: number;
  message: string;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  trend: TrendPoint[];
  weeklyPattern: WeeklyPatternPoint[];
  byMachine: MachineStat[];
  byEmployee: EmployeeStat[];
  anomalies: Anomaly[];
}

export type ShiftFilter = "all" | "day" | "night";

export interface AnalyticsFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  shift: ShiftFilter;
}
