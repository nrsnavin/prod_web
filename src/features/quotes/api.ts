import { httpClient } from "@/core/http/httpClient";
import { Quote, QuoteStatus, QuoteWriteBody, QuoteWinLoss, QuoteWinLossForQuote } from "./types";

export const quoteService = {
  async list(params: { page?: number; limit?: number; status?: QuoteStatus | "all"; search?: string }) {
    const query: Record<string, unknown> = { page: params.page, limit: params.limit ?? 20 };
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.search) query.search = params.search;
    return httpClient.get<{ success: boolean; quotes: Quote[]; total: number; page: number }>(
      "/quote/list",
      query
    );
  },

  async getById(id: string): Promise<Quote> {
    const res = await httpClient.get<{ success: boolean; quote: Quote }>("/quote/detail", { id });
    return res.quote;
  },

  async create(body: QuoteWriteBody): Promise<Quote> {
    const res = await httpClient.post<{ success: boolean; quote: Quote }>("/quote/create", body);
    return res.quote;
  },

  async update(id: string, auditReason: string, body: Partial<QuoteWriteBody>): Promise<Quote> {
    const res = await httpClient.put<{ success: boolean; quote: Quote }>("/quote/update", {
      id,
      auditReason,
      ...body,
    });
    return res.quote;
  },


  // ── Win/loss, read-only ──────────────────────────────────────────
  //
  // Mirrors GET /quote/win-loss. Nothing here writes, and nothing on
  // the pricing form reads it to fill a figure in: it reports what
  // happened to prices already named, and the person still names the
  // next one.
  winLoss(params: { days?: number; customerId?: string; productName?: string } = {}) {
    return httpClient.get<QuoteWinLoss>("/quote/win-loss", params as Record<string, unknown>);
  },

  winLossForQuote(id: string) {
    return httpClient.get<QuoteWinLossForQuote>("/quote/win-loss/for-quote", { id });
  },

  setStatus: (id: string, status: QuoteStatus) =>
    httpClient.patch("/quote/status", { id, status }),

  // The server-rendered quotation, from the same template designer the
  // purchase order and challan use.
  pdfBlob: (id: string) => httpClient.getBlob(`/quote/${id}/pdf`),
};
