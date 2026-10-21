import { httpClient } from "@/core/http/httpClient";
import { DispatchItem, DispatchQueue, Urgency } from "./types";

export const dispatchService = {
  queue(view: "open" | "dispatched" = "open"): Promise<DispatchQueue> {
    return httpClient.get<DispatchQueue>("/dispatch/queue", view === "dispatched" ? { view } : undefined);
  },
  async setUrgency(id: string, urgency: Urgency): Promise<DispatchItem> {
    return (await httpClient.patch<{ item: DispatchItem }>(`/dispatch/${id}/urgency`, { urgency })).item;
  },
  async markDispatched(id: string, note: string): Promise<DispatchItem> {
    return (await httpClient.post<{ item: DispatchItem }>(`/dispatch/${id}/dispatched`, { note })).item;
  },
  async remove(id: string, reason: string): Promise<DispatchItem> {
    return (await httpClient.post<{ item: DispatchItem }>(`/dispatch/${id}/cancel`, { reason })).item;
  },
};
