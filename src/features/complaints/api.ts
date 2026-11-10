import { httpClient } from "@/core/http/httpClient";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";
import type {
  ComplaintRow, ComplaintCategory, ComplaintStatus, TraceResult, ThemesReport,
} from "./types";
import { uploadForm } from "@/core/http/upload";

export interface ComplaintListResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  data: ComplaintRow[];
}

/** A job the customer's message most likely means, with why. */
export interface IntakeJob { _id: string; jobOrderNo?: number; date: string; status: string; elastics: Array<{ _id: string; name: string }>; why: string }
export interface Intake {
  category: ComplaintCategory;
  reason: string;
  jobs: IntakeJob[];
  elastic: { _id: string; name: string } | null;
  confidence: number;
  aiGenerated: boolean;
  aiSuggestion: string | null;
  candidates: number;
}
export interface ReplyDraft { text: string; aiGenerated: boolean; aiSuggestion: string | null; phone: string }

export const complaintService = {
  list(params: { status?: string; category?: string; page?: number; limit?: number } = {}) {
    return httpClient.get<ComplaintListResponse>("/complaint", params);
  },

  get(id: string) {
    return httpClient.get<{ success: boolean; data: ComplaintRow }>(`/complaint/${id}`);
  },

  create(body: {
    customer: string; job: string; elastic?: string;
    category: ComplaintCategory; reason: string; feedback?: string; aiSuggestion?: string;
  }) {
    return httpClient.post<{ success: boolean; data: ComplaintRow }>("/complaint", body);
  },

  /** What the customer sent, read into the form. Nothing is saved. */
  async intake(customer: string, text: string, photos: File[] = []): Promise<Intake> {
    const fd = new FormData();
    fd.append("customer", customer);
    fd.append("text", text);
    for (const p of photos.slice(0, 3)) fd.append("photos", p);
    return (await uploadForm<{ data: Intake }>("/complaint/intake", fd, "Could not read the message")).data;
  },

  async replyDraft(id: string) {
    return (await httpClient.get<{ success: boolean; data: ReplyDraft }>(`/complaint/${id}/reply-draft`, undefined, { timeoutMs: MODEL_TIMEOUT_MS })).data;
  },

  replySent(id: string, body: { text: string; aiSuggestion?: string | null }) {
    return httpClient.post<{ success: boolean; data: { feedback: string } }>(`/complaint/${id}/reply`, body);
  },

  update(id: string, body: {
    status?: ComplaintStatus; resolution?: string; feedback?: string;
    category?: ComplaintCategory;
  }) {
    return httpClient.put<{ success: boolean; data: ComplaintRow }>(`/complaint/${id}`, body);
  },

  /** The blast radius. Deterministic — no model involved. */
  trace(id: string) {
    return httpClient.get<{ success: boolean; data: TraceResult }>(`/complaint/${id}/trace`);
  },

  themes(days = 365) {
    return httpClient.get<{ success: boolean; data: ThemesReport }>("/complaint/themes", { days }, { timeoutMs: MODEL_TIMEOUT_MS });
  },
};
