import { httpClient } from "@/core/http/httpClient";
import type {
  ComplaintRow, ComplaintCategory, ComplaintStatus, TraceResult, ThemesReport,
} from "./types";

export interface ComplaintListResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  limit: number;
  data: ComplaintRow[];
}

export const complaintService = {
  list(params: { status?: string; category?: string; page?: number; limit?: number } = {}) {
    return httpClient.get<ComplaintListResponse>("/complaint", params);
  },

  get(id: string) {
    return httpClient.get<{ success: boolean; data: ComplaintRow }>(`/complaint/${id}`);
  },

  create(body: {
    customer: string; job: string; elastic?: string;
    category: ComplaintCategory; reason: string; feedback?: string;
  }) {
    return httpClient.post<{ success: boolean; data: ComplaintRow }>("/complaint", body);
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
    return httpClient.get<{ success: boolean; data: ThemesReport }>("/complaint/themes", { days });
  },
};
