import { httpClient } from "@/core/http/httpClient";
import { Shift, Slip, SlipEdit } from "./types";

export type SlipFilter = "open" | "applied" | "discarded" | "all";

export const slipService = {
  async list(status: SlipFilter, page: number) {
    return httpClient.get<{ slips: Slip[]; total: number; page: number; pageSize: number }>("/slips", { status, page });
  },
  async get(id: string): Promise<Slip> {
    return (await httpClient.get<{ slip: Slip }>(`/slips/${encodeURIComponent(id)}`)).slip;
  },
  photo(id: string, page: number): Promise<Blob> {
    return httpClient.getBlob(`/slips/${encodeURIComponent(id)}/photo/${page}`);
  },
  async upload(files: File[], fields: { caption?: string; dateKey?: string; shift?: Shift | "" }): Promise<Slip> {
    const form = new FormData();
    for (const f of files) form.append("photos", f);
    if (fields.caption) form.append("caption", fields.caption);
    if (fields.dateKey) form.append("dateKey", fields.dateKey);
    if (fields.shift) form.append("shift", fields.shift);
    return (await httpClient.post<{ slip: Slip }>("/slips/upload", form)).slip;
  },
  async setShift(id: string, dateKey: string, shift: Shift): Promise<Slip> {
    return (await httpClient.post<{ slip: Slip }>(`/slips/${encodeURIComponent(id)}/shift`, { dateKey, shift })).slip;
  },
  apply(id: string, rows: SlipEdit[], expectedVersion: number) {
    return httpClient.post<{ saved: number; skipped: { id: string; reason: string }[]; remaining: number; slip: Slip }>(
      `/slips/${encodeURIComponent(id)}/apply`,
      {
        expectedVersion,
        rows: rows.map((r) => ({
          index: r.index,
          include: r.include,
          production: r.production === "" ? null : r.production,
          timer: r.timer || null,
          remarks: r.remarks,
        })),
      }
    );
  },
  async discard(id: string): Promise<Slip> {
    return (await httpClient.post<{ slip: Slip }>(`/slips/${encodeURIComponent(id)}/discard`, {})).slip;
  },
};
