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

  async update(id: string, body: CustomerFormValues): Promise<Customer> {
    const res = await httpClient.put<{ success: boolean; data: Customer }>(
      "/customer/update",
      { _id: id, ...body }
    );
    return res.data;
  },

  async deactivate(id: string): Promise<void> {
    await httpClient.delete("/customer/delete-customer", { id });
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
};

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
