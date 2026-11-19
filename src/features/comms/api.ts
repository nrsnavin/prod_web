import { httpClient } from "@/core/http/httpClient";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";
import { config } from "@/app/config";
import { Announcement } from "@/features/dashboard/api";
import { uploadForm } from "@/core/http/upload";

export interface AnnouncementFormValues {
  title: string;
  body: string;
  type?: string;
  audience?: "all" | "department";
  department?: string;
  isPinned?: boolean;
  validUntil?: string;
}

export const announcementService = {
  async list(): Promise<Announcement[]> {
    const res = await httpClient.get<{ success: boolean; data: Announcement[] }>("/announcement/");
    return res.data;
  },
  create: (body: AnnouncementFormValues) => httpClient.post("/announcement/", body),
  update: (id: string, body: Partial<AnnouncementFormValues> & { isActive?: boolean }) =>
    httpClient.put(`/announcement/${id}`, body),
  remove: (id: string) => httpClient.delete(`/announcement/${id}`),
};

/** The statuses a note can have (api/feedback.js). */
export const FEEDBACK_STATUSES = ["open", "in_review", "resolved", "rejected", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** A worker's complaint or suggestion, as the office is sent it (models/EmployeeFeedback.js). */
export interface FeedbackItem {
  _id: string;
  /** The author. Never sent for a note sent anonymously. */
  employee?: { _id: string; name: string; department?: string } | null;
  isAnonymous?: boolean;
  type?: string;
  category?: string;
  subject?: string;
  body?: string;
  status: FeedbackStatus | string;
  response?: string;
  respondedBy?: { name?: string } | null;
  respondedAt?: string;
  createdAt?: string;
}

export const feedbackService = {
  async list(status: string): Promise<FeedbackItem[]> {
    const res = await httpClient.get<{ success: boolean; data: FeedbackItem[] }>(
      "/feedback/",
      status !== "all" ? { status } : undefined
    );
    return res.data;
  },
  /**
   * Reply and/or move the note on. `response` left out says nothing of
   * the reply — the server keeps it, and who gave it.
   */
  respond: (id: string, body: { response?: string; status?: string }) =>
    httpClient.put(`/feedback/${id}/respond`, body),
};

/** A login named on an issue: the name when the server sent it, else just its id. */
export type IssueLogin = { _id: string; name?: string } | string | null;

export interface MachineIssue {
  _id: string;
  machine?: { _id: string; ID: string; status?: string } | null;
  /** The operator: who reported it — or, raised at the floor entry, whose loom it is. */
  employee?: { _id: string; name: string; department?: string } | null;
  /** worker: the operator's own report; admin: raised by the office; floor: by the supervisor at the floor entry. */
  source?: "worker" | "admin" | "floor";
  /** The office login that filed it. */
  reportedBy?: IssueLogin;
  /** The supervisor's name, for an issue raised at the floor entry. */
  reportedByName?: string;
  title?: string;
  description?: string;
  severity?: string;
  status: string;
  resolutionNotes?: string;
  /** When it was resolved or dismissed, and by whom. */
  resolvedAt?: string;
  resolvedBy?: IssueLogin;
  createdAt?: string;
}

export interface MachineIssueCreate {
  machineId: string;
  title: string;
  description: string;
  severity: string;
  aiSuggestion?: string;
}

/** What the worker said, written up; with the machine's open issues. */
export interface IssueIntake {
  title: string;
  description: string;
  severity: string;
  duplicateOf: string | null;
  confidence: number;
  openIssues: Array<{ _id: string; title: string; severity?: string; status: string; createdAt?: string }>;
  aiGenerated: boolean;
  aiSuggestion: string | null;
}

export interface MachineAnomaly {
  machineId: string;
  machineID?: string;
  status?: string;
  count: number;
  openCount: number;
  critical: number;
  lastIssueAt?: string;
}

export const issueService = {
  async list(status: string): Promise<MachineIssue[]> {
    const res = await httpClient.get<{ success: boolean; data: MachineIssue[] }>(
      "/machine-issue/",
      status !== "all" ? { status } : undefined
    );
    return res.data;
  },
  create: (body: MachineIssueCreate) => httpClient.post("/machine-issue/", body),
  /** Write up what the worker said or photographed. Nothing is saved. */
  async intake(machineId: string, text: string, photo?: File | null): Promise<IssueIntake> {
    const fd = new FormData();
    fd.append("machineId", machineId);
    fd.append("text", text);
    if (photo) fd.append("photo", photo);
    return (await uploadForm<{ data: IssueIntake }>("/machine-issue/intake", fd, "Could not write it up")).data;
  },
  /**
   * Move an issue on. `resolutionNotes` left out says nothing of the
   * notes — the server keeps what it has; a text, "" included, replaces them.
   */
  setStatus: (id: string, status: string, resolutionNotes?: string) =>
    httpClient.put(`/machine-issue/${id}/status`, { status, resolutionNotes }),
  async anomalies(days = 30, threshold = 3): Promise<{ windowDays: number; threshold: number; anomalies: MachineAnomaly[] }> {
    return httpClient.get("/machine-issue/anomalies", { days, threshold });
  },
};

export interface NotificationSettings {
  enabled: boolean;
  recipients: Array<string | { phone?: string; number?: string; name?: string; events?: string[] }>;
  events?: Record<string, boolean> | string[];
  quietHours?: { start?: string; end?: string } | null;
  timezone?: string;
}

export const notifyService = {
  async settings(): Promise<{ settings: NotificationSettings; provider: { name: string; configured: boolean } }> {
    return httpClient.get("/notify/settings");
  },
  update: (body: Partial<NotificationSettings>) => httpClient.put("/notify/settings", body),
  async scheduled(): Promise<{ data: Record<string, ScheduledReport> }> {
    return httpClient.get("/notify/scheduled");
  },
};

export interface ScheduledReport {
  at: string;
  weekday?: number;
  last: { day: string; at: string; ok: boolean | null; error?: string; trigger?: string } | null;
}

export const advisorService = {
  briefing: (cards: unknown[]) =>
    httpClient.post<{ success: boolean; summary?: string; message?: string }>(
      "/advisor/briefing",
      { cards },
      { timeoutMs: MODEL_TIMEOUT_MS }
    ),
};

export const ioService = {
  templateUrl: `${config.apiBaseUrl}/io/template`,
  exportUrl: `${config.apiBaseUrl}/io/export`,
};
