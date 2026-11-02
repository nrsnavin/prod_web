import { httpClient } from "@/core/http/httpClient";
import { Customer, CustomerFormValues, CustomerListResult } from "./types";

// Endpoints predate REST conventions, so this service maps them explicitly
// rather than using the generic CRUD factory (same CrudService-like shape).
export const customerService = {
  async list(params: { page?: number; limit?: number; search?: string }): Promise<CustomerListResult> {
    const res = await httpClient.get<{ success: boolean } & CustomerListResult>(
      "/customer/all-customers",
      params
    );
    return { customers: res.customers, total: res.total, page: res.page, pages: res.pages };
  },

  async getById(id: string): Promise<Customer> {
    const res = await httpClient.get<{ success: boolean; customer: Customer }>(
      "/customer/customerDetail",
      { id }
    );
    return res.customer;
  },

  async create(body: CustomerFormValues): Promise<Customer> {
    const res = await httpClient.post<{ success: boolean; data: Customer }>(
      "/customer/create",
      body
    );
    return res.data;
  },

  async update(id: string, body: CustomerFormValues, expectedVersion?: number): Promise<Customer> {
    const res = await httpClient.put<{ success: boolean; data: Customer }>(
      "/customer/update",
      { _id: id, ...body, ...(expectedVersion === undefined ? {} : { expectedVersion }) }
    );
    return res.data;
  },

  // Soft delete. The old call went to /delete-customer, a route that
  // never existed — so the button 404'd. Archiving hides the customer
  // from lists while their orders and challans keep their references.
  async setArchived(id: string, archived: boolean): Promise<void> {
    await httpClient.patch(`/customer/${id}/archive`, { archived });
  },

  async orders(id: string): Promise<CustomerOrders> {
    const res = await httpClient.get<{ success: boolean } & CustomerOrders>(
      "/customer/orders",
      { id }
    );
    return {
      running: res.running ?? [],
      past: res.past ?? [],
      pastTotal: res.pastTotal ?? 0,
      hasMore: res.hasMore ?? false,
    };
  },

  /** Latest orders, challans and invoices in one read (api/customer.js /:id/recent). */
  async recent(id: string): Promise<CustomerRecent> {
    const res = await httpClient.get<{ success: boolean } & CustomerRecent>(`/customer/${id}/recent`);
    return {
      orders: res.orders ?? [],
      orderTotal: res.orderTotal ?? 0,
      dcs: res.dcs ?? [],
      dcTotal: res.dcTotal ?? 0,
      invoices: res.invoices ?? [],
      invoiceTotal: res.invoiceTotal ?? 0,
      invoiced: res.invoiced ?? { amount: 0, count: 0 },
    };
  },
};

export interface CustomerRecentDc {
  _id: string;
  dcNumber: string;
  status: string;
  type?: string;
  dispatchDate?: string;
  totalQuantity?: number;
  orderNo?: number;
  order?: string;
}
export interface CustomerRecentInvoice {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  totals?: { grand?: number };
  einvoice?: { status?: string; irn?: string };
  orderNo?: number;
  order?: string;
}
export interface CustomerRecent {
  orders: CustomerOrderRow[];
  orderTotal: number;
  dcs: CustomerRecentDc[];
  dcTotal: number;
  invoices: CustomerRecentInvoice[];
  invoiceTotal: number;
  invoiced: { amount: number; count: number };
}

export interface CustomerOrderRow {
  _id: string;
  orderNo: number;
  po?: string;
  status: string;
  supplyDate?: string;
  createdAt?: string;
}
export interface CustomerOrders {
  running: CustomerOrderRow[];
  past: CustomerOrderRow[];
  pastTotal: number;
  hasMore: boolean;
}
