import { httpClient } from "@/core/http/httpClient";

export type ClaimStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";
export interface Claim {
  _id: string;
  expenseNo: string;
  date: string;
  categoryName: string;
  description: string;
  totals: { grand: number };
  status: ClaimStatus;
  approval?: { byName?: string; note?: string; at?: string };
  paidAmount?: number;
  paidAt?: string;
  attachments?: Array<{ _id: string; filename: string; contentType: string; size: number }>;
}

export const claimsService = {
  categories: async () => (await httpClient.get<{ success: boolean; categories: Array<{ _id: string; name: string; claimDailyLimit?: number }> }>("/claims/categories")).categories,
  mine: () => httpClient.get<{ success: boolean; claims: Claim[]; owed: number; waiting: number }>("/claims"),
  create: async (body: { category: string; description: string; amount: number; date: string; note?: string; requestId?: string }) =>
    (await httpClient.post<{ success: boolean; claim: Claim }>("/claims", body)).claim,
  withdraw: (id: string) => httpClient.post<{ success: boolean }>(`/claims/${id}/withdraw`, {}),
  async photo(id: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/v2/claims/${id}/photo`, { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Could not attach the photo");
  },
};
