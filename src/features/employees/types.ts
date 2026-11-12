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

// ── Offboarding ────────────────────────────────────────────────────────
export type OffboardReason = "resigned" | "terminated" | "absconded" | "retired" | "contract_ended" | "other";

export const OFFBOARD_REASON_LABELS: Record<OffboardReason, string> = {
  resigned: "Resigned",
  terminated: "Terminated",
  absconded: "Stopped coming (no notice)",
  retired: "Retired",
  contract_ended: "Contract ended",
  other: "Other",
};

/** Who the list shows: still working here (default), gone, or everyone. */
export type EmployeeStatusFilter = "active" | "left" | "all";

export interface Offboarding {
  lastWorkingDay: string | null;
  reason: OffboardReason | null;
  note?: string;
  recordedByName?: string;
  recordedAt?: string | null;
}

export interface PastOffboarding {
  lastWorkingDay?: string;
  reason?: OffboardReason;
  note?: string;
  recordedByName?: string;
  recordedAt?: string;
  reinstatedAt?: string;
  reinstatedByName?: string;
}

export interface OffboardResult {
  success: boolean;
  employee: { id: string; name: string; status: "offboarded"; lastWorkingDay: string; reason: OffboardReason };
  workerLoginClosed: boolean;
  /** Their other login, still listed under Users. `staysOpen`: an administrator's, which leaving does not close. */
  managerLogin: { id: string; email: string; staysOpen?: boolean } | null;
}

/** A shift that keeps someone from leaving on the day asked (EMPLOYEE_HAS_LATER_SHIFTS). */
export interface LaterShift {
  id: string;
  date: string;
  shift: string | null;
  status: string;
  machine: string | null;
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
  status?: "active" | "offboarded";
  offboarding?: { lastWorkingDay?: string; reason?: OffboardReason };
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
  /** Document version; sent back as `expectedVersion` so a stale edit is a 409, not an overwrite. */
  __v?: number;
  name: string;
  phoneNumber?: string;
  department: string;
  role?: string;
  aadhar?: string;
  performance?: number;
  skill?: number;
  hourlyRate?: number;
  skillProfile?: SkillProfile | null;
  /** As on their Aadhaar card ("" when not recorded). */
  dob?: string;
  gender?: "male" | "female" | "other" | "";
  address?: string;
  pincode?: string;
  /** The last check of their Aadhaar card's QR code; null until someone checks it. */
  aadhaarCheck?: AadhaarCheck | null;
  status?: "active" | "offboarded";
  offboarding?: Offboarding | null;
  pastOffboardings?: PastOffboarding[];
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
  dob?: string;
  gender?: "male" | "female" | "other" | "";
  address?: string;
  pincode?: string;
  /** A new employee's Aadhaar QR code, scanned on the form: the server reads it again and keeps the check. */
  aadhaarQr?: string;
  aadhaarQrConsent?: boolean;
}

// ── The QR code on an Aadhaar card (POST /employee/aadhaar-qr) ──────

export type AadhaarSignature = "valid" | "invalid" | "unchecked" | "unsigned";
export type NameMatch = "same" | "close" | "different";

export interface AadhaarQrFields {
  name: string;
  /** YYYY-MM-DD (a year alone comes as YYYY-01-01), or null when unreadable. */
  dob: string | null;
  gender: "male" | "female" | "other" | null;
  careOf: string;
  address: string;
  pincode: string;
}

export interface AadhaarQrRead {
  /** "secure": the signed code on cards since 2019; "old": the earlier XML code, unsigned. */
  kind: "secure" | "old";
  version: string | null;
  /** Whether the fields could be read: "guessed" is a newer layout whose fields all had their shape. */
  layout: "known" | "guessed" | "unreadable";
  signature: AadhaarSignature;
  /** The UIDAI certificate it verified against. */
  key: string | null;
  last4: string | null;
  issuedAt: string | null;
  fields: AadhaarQrFields | null;
  /** The full number: only the old XML code carries it. */
  aadhaar: string | null;
  mobileLast4: string | null;
}

export interface AadhaarQrMatches {
  last4: boolean | null;
  name: NameMatch | null;
  phone: boolean | null;
}

/** What is kept on the employee: the outcome only. */
export interface AadhaarCheck {
  method: "qr";
  kind: "secure" | "old";
  version?: string;
  layout: "known" | "guessed" | "unreadable";
  signature: AadhaarSignature;
  key?: string;
  last4?: string;
  issuedAt?: string | null;
  nameOnCard?: string;
  dobOnCard?: string;
  genderOnCard?: string;
  matches: AadhaarQrMatches;
  consent: boolean;
  at: string;
  byName?: string;
}

export interface AadhaarQrResult {
  read: AadhaarQrRead;
  matches: AadhaarQrMatches;
  /** Set when an employee was named: the outcome kept on their record. */
  check: AadhaarCheck | null;
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
