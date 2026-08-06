import { httpClient } from "@/core/http/httpClient";
import { config } from "@/app/config";
import {
  SampleCreateValues,
  SampleDetail,
  SampleListResponse,
  SampleStatus,
} from "./types";

export interface SampleListQuery {
  status?: SampleStatus | "active" | "all";
  q?: string;
  page?: number;
  limit?: number;
}

export const sampleService = {
  list(query: SampleListQuery): Promise<SampleListResponse> {
    const params: Record<string, unknown> = {};
    if (query.status && query.status !== "all") params.status = query.status;
    if (query.q) params.q = query.q;
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;
    return httpClient.get<SampleListResponse>("/sample", params);
  },

  async detail(id: string): Promise<SampleDetail> {
    const res = await httpClient.get<{ sample: SampleDetail }>(`/sample/${id}`);
    return res.sample;
  },

  async create(body: SampleCreateValues): Promise<SampleDetail> {
    const res = await httpClient.post<{ sample: SampleDetail }>("/sample", body);
    return res.sample;
  },

  async addLog(id: string, note: string): Promise<SampleDetail> {
    const res = await httpClient.post<{ sample: SampleDetail }>(`/sample/${id}/log`, { note });
    return res.sample;
  },

  async setStatus(id: string, status: SampleStatus, note: string): Promise<SampleDetail> {
    const res = await httpClient.put<{ sample: SampleDetail }>(`/sample/${id}/status`, {
      status,
      note,
    });
    return res.sample;
  },

  // Multipart — axios sets the boundary itself when handed a FormData.
  async addPhoto(id: string, file: File, caption: string): Promise<SampleDetail> {
    const form = new FormData();
    form.append("photo", file);
    form.append("caption", caption);
    const res = await httpClient.post<{ sample: SampleDetail }>(`/sample/${id}/photo`, form);
    return res.sample;
  },

  async removePhoto(photoId: string, reason: string): Promise<SampleDetail> {
    const res = await httpClient.delete<{ sample: SampleDetail }>(
      `/sample/photo/${photoId}`,
      { reason }
    );
    return res.sample;
  },

  /**
   * Straight <img src>. The bytes come back from the API with the auth
   * cookie the browser already holds, so there is nothing to fetch and
   * hold in memory here.
   */
  photoUrl: (photoId: string) => `${config.apiBaseUrl}/sample/photo/${photoId}/file`,
};
