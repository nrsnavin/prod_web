import { httpClient } from "@/core/http/httpClient";
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
   * The bytes, fetched through the authenticated XHR path.
   *
   * NOT a plain <img src={apiBaseUrl}/…>. The API sends
   * `Cross-Origin-Resource-Policy: same-origin` (helmet's default, see
   * app.js), which is exactly a rule against embedding its responses in
   * another origin's page — so the request succeeds and the browser
   * refuses to paint it. In dev the API is same-origin through the Vite
   * proxy, so an <img> works there and only breaks once deployed.
   *
   * A CORS XHR is not an embed, passes the CORS check the API already
   * grants this origin, and is how every other binary in this app is
   * fetched (payslips, DC PDFs, service bills). Relaxing CORP on the
   * route instead would let any site embed a customer's sample photos
   * for anyone logged in, since the auth cookie is SameSite=None.
   */
  photoBlob: (photoId: string): Promise<Blob> =>
    httpClient.getBlob(`/sample/photo/${photoId}/file`),
};
