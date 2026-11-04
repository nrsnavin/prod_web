import { httpClient } from "@/core/http/httpClient";
import type {
  EwaybillBody,
  CustomerInvoices,
  EinvoiceStatus,
  Invoice,
  InvoiceCreateBody,
  InvoiceOrderInfo,
  InvoiceStatus,
  InvoiceSummary,
  IrnPasteBody,
  OrderInvoices,
} from "./types";

export const invoiceService = {
  async list(params: { page?: number; limit?: number; status?: InvoiceStatus | "all"; einvoice?: EinvoiceStatus | "all"; search?: string; customer?: string; order?: string }) {
    const query: Record<string, unknown> = { page: params.page, limit: params.limit ?? 20 };
    if (params.status && params.status !== "all") query.status = params.status;
    if (params.einvoice && params.einvoice !== "all") query.einvoice = params.einvoice;
    if (params.search) query.search = params.search;
    if (params.customer) query.customer = params.customer;
    if (params.order) query.order = params.order;
    return httpClient.get<{ success: boolean; invoices: InvoiceSummary[]; total: number; page: number; pages: number }>("/invoice/list", query);
  },

  async getById(id: string): Promise<Invoice> {
    const res = await httpClient.get<{ success: boolean; invoice: Invoice }>("/invoice/detail", { id });
    return res.invoice;
  },

  /** What an invoice for this order would hold: its challans, the lines, both parties. */
  orderInfo: (orderId: string) => httpClient.get<InvoiceOrderInfo & { success: boolean }>("/invoice/order-info", { id: orderId }),

  async create(body: InvoiceCreateBody): Promise<Invoice> {
    const res = await httpClient.post<{ success: boolean; invoice: Invoice }>("/invoice/create", body);
    return res.invoice;
  },

  pdfBlob: (id: string): Promise<Blob> => httpClient.getBlob(`/invoice/${id}/pdf`),
  einvoiceJsonBlob: (id: string): Promise<Blob> => httpClient.getBlob(`/invoice/${id}/einvoice.json`),

  /** Through the GSP connected in Settings → Invoice. */
  async registerIrn(id: string): Promise<Invoice> {
    const res = await httpClient.post<{ success: boolean; invoice: Invoice }>(`/invoice/${id}/register-irn`, {});
    return res.invoice;
  },

  /** The IRN and signed QR the portal gave back, pasted in. */
  async pasteIrn(id: string, body: IrnPasteBody): Promise<Invoice> {
    const res = await httpClient.post<{ success: boolean; invoice: Invoice }>(`/invoice/${id}/irn`, body);
    return res.invoice;
  },

  /** The e-way bill from the IRN, through the connected GSP. */
  async ewaybill(id: string, body: EwaybillBody): Promise<Invoice> {
    return (await httpClient.post<{ success: boolean; invoice: Invoice }>(`/invoice/${id}/ewaybill`, body)).invoice;
  },
  /** The number from the portal, pasted in. */
  async pasteEwaybill(id: string, body: EwaybillBody): Promise<Invoice> {
    return (await httpClient.post<{ success: boolean; invoice: Invoice }>(`/invoice/${id}/ewaybill/paste`, body)).invoice;
  },
  ewaybillJsonUrl: (id: string) => `/api/v2/invoice/${id}/ewaybill.json`,

  async cancel(id: string, reason: string): Promise<{ invoice: Invoice; portalNote: string }> {
    const res = await httpClient.post<{ success: boolean; invoice: Invoice; portalNote: string }>(`/invoice/${id}/cancel`, { reason });
    return { invoice: res.invoice, portalNote: res.portalNote };
  },

  byOrder: (orderId: string) => httpClient.get<OrderInvoices & { success: boolean }>("/invoice/by-order", { id: orderId }),
  byCustomer: (customerId: string, limit = 6) =>
    httpClient.get<CustomerInvoices & { success: boolean }>("/invoice/by-customer", { id: customerId, limit }),
};
