import { httpClient } from "@/core/http/httpClient";
import { uploadForm } from "@/core/http/upload";

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

export interface ClaimScan {
  problem: null | "not_a_bill" | "unreadable";
  draft: null | { amount: number | null; date: string | null; description: string; refNo: string; category: string | null };
  categoryName?: string | null;
  categoryReason?: string | null;
  payee?: string;
  confidence?: number;
  alreadyClaimed?: string | null;
  aiSuggestion: string | null;
}

export const claimsService = {
  categories: async () => (await httpClient.get<{ success: boolean; categories: Array<{ _id: string; name: string; claimDailyLimit?: number }> }>("/claims/categories")).categories,
  mine: () => httpClient.get<{ success: boolean; claims: Claim[]; owed: number; waiting: number }>("/claims"),
  create: async (body: { category: string; description: string; amount: number; date: string; note?: string; refNo?: string; aiSuggestion?: string; requestId?: string }) =>
    (await httpClient.post<{ success: boolean; claim: Claim }>("/claims", body)).claim,
  withdraw: (id: string) => httpClient.post<{ success: boolean }>(`/claims/${id}/withdraw`, {}),
  /** Read the receipt into a claim; nothing is saved. */
  async scan(file: File): Promise<ClaimScan> {
    const fd = new FormData();
    fd.append("file", file);
    return uploadForm<ClaimScan>("/claims/scan", fd, "Could not read the receipt");
  },
  async photo(id: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await uploadForm(`/claims/${id}/photo`, fd, "Could not attach the photo");
  },
};
