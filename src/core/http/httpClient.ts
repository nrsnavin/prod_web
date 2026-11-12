import axios, { AxiosError, AxiosInstance } from "axios";
import { config } from "@/app/config";
import { DEFAULT_TIMEOUT_MS, MODEL_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from "./timeouts";

// ── DIP boundary ────────────────────────────────────────────────────────
// Feature code depends on this interface, never on axios directly.
// Swapping the transport (fetch, mock for tests) touches only this file.
/** How one call differs from the ordinary. */
export interface CallOptions {
  /** How long to wait for the answer — see MODEL_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface HttpClient {
  get<T>(url: string, params?: Record<string, unknown>, options?: CallOptions): Promise<T>;
  getBlob(url: string, params?: Record<string, unknown>): Promise<Blob>;
  postBlob(url: string, body?: unknown): Promise<Blob>;
  post<T>(url: string, body?: unknown, options?: CallOptions): Promise<T>;
  /** A form with files. Waits longer than an ordinary call — see UPLOAD_TIMEOUT_MS. */
  upload<T>(url: string, form: FormData): Promise<T>;
  put<T>(url: string, body?: unknown, options?: CallOptions): Promise<T>;
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

// The books lock. A posting or a cancellation dated inside a period that
// has been closed is refused with BOOKS_LOCKED; an admin may let it
// through by saying why (the server keeps the reason on the entry and in
// the lock history). The UI registers one asker — a dialog — and every
// write that meets the lock is offered it, then sent again with the
// reason. Without an asker, or when it answers null (not an admin, or
// they decided against it), the refusal goes back to the caller as it
// always did. The HTTP layer knows nothing of dialogs or roles.
type LockOverrideAsker = (error: ApiError) => Promise<string | null>;
let askLockOverride: LockOverrideAsker | undefined;
export function setLockOverrideAsker(asker: LockOverrideAsker | undefined): void {
  askLockOverride = asker;
}

/** `body` with the override reason added: a plain object, or a form with files. */
function withOverride(body: unknown, reason: string): unknown {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const next = new FormData();
    body.forEach((v, k) => next.append(k, v));
    next.set("lockOverride", reason);
    return next;
  }
  return { ...((body && typeof body === "object" ? body : {}) as Record<string, unknown>), lockOverride: reason };
}

/** Send; if the books lock refuses it and an admin gives a reason, send it once more with the reason. */
export async function throughLock<T>(body: unknown, send: (b: unknown) => Promise<T>): Promise<T> {
  try {
    return await send(body);
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "BOOKS_LOCKED" || !askLockOverride) throw err;
    const reason = await askLockOverride(err);
    if (!reason) throw err;
    return send(withOverride(body, reason));
  }
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

// The waits themselves live in ./timeouts; re-exported for the code that
// already takes them from here.
export { DEFAULT_TIMEOUT_MS, MODEL_TIMEOUT_MS, UPLOAD_TIMEOUT_MS };

const wait = (options?: CallOptions) => (options?.timeoutMs ? { timeout: options.timeoutMs } : {});

class AxiosHttpClient implements HttpClient {
  private readonly instance: AxiosInstance;

  constructor(baseURL: string) {
    // withCredentials sends/receives the httpOnly `token` cookie the
    // backend sets on login — the browser equivalent of the Flutter
    // app's manual Cookie header.
    this.instance = axios.create({
      baseURL,
      withCredentials: true,
      timeout: DEFAULT_TIMEOUT_MS,
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

  async get<T>(url: string, params?: Record<string, unknown>, options?: CallOptions): Promise<T> {
    const { data } = await this.instance.get<T>(url, { params, ...wait(options) });
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
  async post<T>(url: string, body?: unknown, options?: CallOptions): Promise<T> {
    return throughLock(body, async (b) => (await this.instance.post<T>(url, b, wait(options))).data);
  }
  async upload<T>(url: string, form: FormData): Promise<T> {
    // No Content-Type here: the browser writes it, with the boundary.
    return throughLock(form, async (b) => (await this.instance.post<T>(url, b, { timeout: UPLOAD_TIMEOUT_MS })).data);
  }
  async put<T>(url: string, body?: unknown, options?: CallOptions): Promise<T> {
    return throughLock(body, async (b) => (await this.instance.put<T>(url, b, wait(options))).data);
  }
  async patch<T>(url: string, body?: unknown): Promise<T> {
    return throughLock(body, async (b) => (await this.instance.patch<T>(url, b)).data);
  }
  async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await this.instance.delete<T>(url, { params });
    return data;
  }
}

export const httpClient: HttpClient = new AxiosHttpClient(config.apiBaseUrl);
