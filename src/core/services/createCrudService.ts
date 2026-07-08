import { HttpClient } from "@/core/http/httpClient";
import { ApiEnvelope, ListParams } from "@/core/api/types";

// ── LSP contract ────────────────────────────────────────────────────────
// Every resource service implements this shape, so list pages, detail
// pages, and mutation hooks work against ANY resource interchangeably.
export interface CrudService<T, TCreate = Partial<T>, TUpdate = TCreate> {
  list(params?: ListParams): Promise<T[]>;
  getById(id: string): Promise<T>;
  create(body: TCreate): Promise<T>;
  update(id: string, body: TUpdate): Promise<T>;
  remove(id: string): Promise<void>;
}

export interface CrudPaths {
  list?: string; // default ""
  detail?: (id: string) => string; // default (id) => `/${id}`
  create?: string; // default ""
  update?: (id: string) => string; // default (id) => `/${id}`
  remove?: (id: string) => string; // default (id) => `/${id}`
}

// ── OCP factory ─────────────────────────────────────────────────────────
// New backend resources get a service by configuration, not by writing a
// new class. Endpoints that deviate from REST conventions override the
// relevant path only.
export function createCrudService<T, TCreate = Partial<T>, TUpdate = TCreate>(
  client: HttpClient,
  basePath: string,
  paths: CrudPaths = {}
): CrudService<T, TCreate, TUpdate> {
  const p = {
    list: paths.list ?? "",
    detail: paths.detail ?? ((id: string) => `/${id}`),
    create: paths.create ?? "",
    update: paths.update ?? ((id: string) => `/${id}`),
    remove: paths.remove ?? ((id: string) => `/${id}`),
  };

  const unwrap = <R>(res: ApiEnvelope<R> | R): R =>
    res !== null && typeof res === "object" && "data" in (res as object)
      ? (res as ApiEnvelope<R>).data
      : (res as R);

  return {
    async list(params?: ListParams) {
      return unwrap(
        await client.get<ApiEnvelope<T[]>>(`${basePath}${p.list}`, params)
      );
    },
    async getById(id: string) {
      return unwrap(
        await client.get<ApiEnvelope<T>>(`${basePath}${p.detail(id)}`)
      );
    },
    async create(body: TCreate) {
      return unwrap(
        await client.post<ApiEnvelope<T>>(`${basePath}${p.create}`, body)
      );
    },
    async update(id: string, body: TUpdate) {
      return unwrap(
        await client.put<ApiEnvelope<T>>(`${basePath}${p.update(id)}`, body)
      );
    },
    async remove(id: string) {
      await client.delete(`${basePath}${p.remove(id)}`);
    },
  };
}
