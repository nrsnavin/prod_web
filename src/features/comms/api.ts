import { httpClient } from "@/core/http/httpClient";
import { config } from "@/app/config";
import { Announcement } from "@/features/dashboard/api";

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

export interface FeedbackItem {
  _id: string;
  employee?: { _id: string; name: string; department?: string } | null;
  type?: string;
  category?: string;
  message?: string;
  text?: string;
  status: string;
  response?: string;
  respondedBy?: { name?: string } | null;
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
  respond: (id: string, body: { response?: string; status?: string }) =>
    httpClient.put(`/feedback/${id}/respond`, body),
};

export interface MachineIssue {
  _id: string;
  machine?: { _id: string; ID: string; status?: string } | null;
  employee?: { _id: string; name: string; department?: string } | null;
  title?: string;
  description?: string;
  severity?: string;
  status: string;
  resolutionNotes?: string;
  createdAt?: string;
}

export const issueService = {
  async list(status: string): Promise<MachineIssue[]> {
    const res = await httpClient.get<{ success: boolean; data: MachineIssue[] }>(
      "/machine-issue/",
      status !== "all" ? { status } : undefined
    );
    return res.data;
  },
  setStatus: (id: string, status: string, resolutionNotes?: string) =>
    httpClient.put(`/machine-issue/${id}/status`, { status, resolutionNotes }),
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
};

export const advisorService = {
  briefing: (cards: unknown[]) =>
    httpClient.post<{ success: boolean; summary?: string; message?: string }>(
      "/advisor/briefing",
      { cards }
    ),
};

export const ioService = {
  templateUrl: `${config.apiBaseUrl}/io/template`,
  exportUrl: `${config.apiBaseUrl}/io/export`,
};
