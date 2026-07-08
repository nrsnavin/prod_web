export interface Employee {
  _id: string;
  name: string;
  phoneNumber?: string;
  aadhar?: string;
  skill?: number;
  role?: string;
  department: string;
  performance?: number;
  hourlyRate?: number;
  createdAt?: string;
}

export interface EmployeeShiftRow {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT";
  machine: string;
  runtimeMinutes: number;
  outputMeters: number;
  efficiency: number;
}

export interface EmployeeDetail {
  id: string;
  name: string;
  phoneNumber?: string;
  department: string;
  role?: string;
  aadhar?: string;
  performance?: number;
  skill?: number;
  totalShifts?: number;
  result: EmployeeShiftRow[];
}

export interface EmployeeFormValues {
  name: string;
  department: string;
  phoneNumber?: string;
  role?: string;
  aadhar?: string;
}

export const DEPARTMENTS = [
  "weaving",
  "warping",
  "covering",
  "packing",
  "checking",
  "office",
  "other",
] as const;
