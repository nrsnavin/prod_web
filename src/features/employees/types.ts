// ── Skill & performance questionnaire (onboarding) ────────────────────
export type SkillLevel = "not_known" | "basic" | "good" | "expert";

export const SKILL_LEVELS: SkillLevel[] = ["not_known", "basic", "good", "expert"];

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  not_known: "Not known",
  basic: "Basic",
  good: "Good",
  expert: "Expert",
};

/** The 10 skills from the questionnaire, in display order. */
export const SKILL_KEYS = [
  ["drawing", "Drawing"],
  ["knotting", "Knotting"],
  ["tapeSetting", "Tape setting"],
  ["chainLinkSetting", "Chain link setting"],
  ["chainDesign", "Chain design"],
  ["jacquardHookModule", "Jacquard hook (module type)"],
  ["jacquardHookKarampal", "Jacquard hook (karampal type)"],
  ["timingBeltChange", "Timing belt change"],
  ["timingSetting", "Timing setting"],
  ["machineRepair", "Machine repair"],
] as const;

export interface SkillProfile {
  machineType?: string;
  yearsOfExperience?: number;
  knotting?: {
    time100YarnsMin?: number | null;
    quality?: "" | "poor" | "average" | "good" | "excellent";
    maxYarnsAtOnce?: number | null;
  };
  production?: {
    minPerShift?: number | null;
    avgEfficiencyPct?: number | null;
    machinesSimultaneous?: number | null;
  };
  skills?: Partial<Record<(typeof SKILL_KEYS)[number][0], SkillLevel>>;
  supervisor?: {
    skillLevel?: number | null;
    machineEfficiency?: number | null;
    problemSolving?: number | null;
    discipline?: number | null;
  };
}

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
  hourlyRate?: number;
  skillProfile?: SkillProfile | null;
  totalShifts?: number;
  result: EmployeeShiftRow[];
}

export interface EmployeeFormValues {
  name: string;
  department: string;
  phoneNumber?: string;
  role?: string;
  aadhar?: string;
  hourlyRate?: number;
  skillProfile?: SkillProfile;
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
