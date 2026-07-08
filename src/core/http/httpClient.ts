import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "@/app/config";

// ── DIP boundary ────────────────────────────────────────────────────────
// Feature code depends on this interface, never on axios directly.
// Swapping the transport (fetch, mock for tests) touches only this file.
export interface HttpClient {
  get<T>(url: string, params?: Record<string, unknown>): Promise<T>;
  post<T>(url: string, body?: unknown): Promise<T>;
  put<T>(url: string, body?: unknown): Promise<T>;
  patch<T>(url: string, body?: unknown): Promise<T>;
  delete<T>(url: string, params?: Record<string, unknown>): Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
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

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string }>;
    const message =
      ax.response?.data?.message ||
      (ax.code === "ECONNABORTED"
        ? "Request timed out — check your connection."
        : ax.message);
    return new ApiError(message, ax.response?.status, error);
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
