import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "@/app/config";

// ── DIP boundary ────────────────────────────────────────────────────────
// Feature code depends on this interface, never on axios directly.
// Swapping the transport (fetch, mock for tests) touches only this file.
export interface HttpClient {
  get<T>(url: string, params?: Record<string, unknown>): Promise<T>;
  getBlob(url: string, params?: Record<string, unknown>): Promise<Blob>;
  postBlob(url: string, body?: unknown): Promise<Blob>;
  post<T>(url: string, body?: unknown): Promise<T>;
  put<T>(url: string, body?: unknown): Promise<T>;
  patch<T>(url: string, body?: unknown): Promise<T>;
  delete<T>(url: string, params?: Record<string, unknown>): Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
    // Route-supplied diagnostics the backend attaches to the error body
    // (e.g. INSUFFICIENT_STOCK + a shortfall payload) so features can
    // branch on them — the force-approve flow reads these.
    public readonly code?: string,
    public readonly data?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Session-expiry hook. The auth layer registers a handler; the HTTP layer
// stays ignorant of routing/stores (SRP — it only reports the 401).
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | undefined;
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

// Exported for unit tests — the interceptor uses it to normalise every
// axios failure into an ApiError, preserving route-supplied diagnostics.
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string; code?: string }>;
    const body = ax.response?.data;
    const message =
      body?.message ||
      (ax.code === "ECONNABORTED"
        ? "Request timed out — check your connection."
        : ax.message);
    return new ApiError(
      message,
      ax.response?.status,
      error,
      typeof body?.code === "string" ? body.code : undefined,
      body && typeof body === "object" ? (body as Record<string, unknown>) : undefined
    );
  }
  // Already converted — hand it straight back. The interceptor runs
  // toApiError on every rejection, so a page that calls it again on
  // what it caught was landing here and having the server's message
  // replaced with "Unexpected error". Every caller of this function is
  // downstream of that interceptor, so this was ALWAYS the path, and
  // any flow that branched on the message silently stopped working:
  // the stock-count partial-post override read `/have not been
  // counted/` off a string that by then said "Unexpected error".
  if (error instanceof ApiError) return error;

  // A real Error that never went through axios at all — keep its
  // message, which is more than "Unexpected error" tells anybody.
  if (error instanceof Error && error.message) {
    return new ApiError(error.message, undefined, error);
  }
  return new ApiError("Unexpected error", undefined, error);
}

class AxiosHttpClient implements HttpClient {
  private readonly instance: AxiosInstance;

  constructor(baseURL: string) {
    // withCredentials sends/receives the httpOnly `token` cookie the
    // backend sets on login — the browser equivalent of the Flutter
    // app's manual Cookie header.
    this.instance = axios.create({
      baseURL,
      withCredentials: true,
      timeout: 20_000,
    });

    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          onUnauthorized?.();
        }
        return Promise.reject(toApiError(error));
      }
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await this.instance.get<T>(url, { params });
    return data;
  }
  async getBlob(url: string, params?: Record<string, unknown>): Promise<Blob> {
    const { data } = await this.instance.get(url, { params, responseType: "blob" });
    return data as Blob;
  }
  async postBlob(url: string, body?: unknown): Promise<Blob> {
    const { data } = await this.instance.post(url, body, { responseType: "blob" });
    return data as Blob;
  }
  async post<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.instance.post<T>(url, body);
    return data;
  }
  async put<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.instance.put<T>(url, body);
    return data;
  }
  async patch<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.instance.patch<T>(url, body);
    return data;
  }
  async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await this.instance.delete<T>(url, { params });
    return data;
  }
}

export const httpClient: HttpClient = new AxiosHttpClient(config.apiBaseUrl);
