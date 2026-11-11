import axios, { AxiosError } from "axios";

// ══════════════════════════════════════════════════════════════════
//  THE PORTAL'S API  (/api/v3/portal on the server)
//
//  Its own client, not the staff app's: a different cookie, and a
//  signed-out answer means "show the sign-in page", not "go to the staff
//  login". A production build talks to the API host; the dev server
//  proxies /api there, so the cookie is same-origin while developing.
// ══════════════════════════════════════════════════════════════════

/** Where a portal build sends requests when nothing else is configured. */
export const DEFAULT_PORTAL_API = "https://api.baluelastics.com/api/v3/portal";

/**
 * The portal's API address. A built portal is served from its own host and
 * the API from another, so a build gets the API host's full address; only
 * the dev server, which forwards /api, gets a relative one.
 */
export function resolvePortalApi(env: { VITE_PORTAL_API_BASE?: string; PROD?: boolean }): string {
  if (env.VITE_PORTAL_API_BASE) return env.VITE_PORTAL_API_BASE;
  return env.PROD ? DEFAULT_PORTAL_API : "/api/v3/portal";
}

// Read as direct member accesses, so Vite replaces each one at build time
// (see app/config.ts for why passing import.meta.env whole is not safe).
export const PORTAL_API = resolvePortalApi({
  VITE_PORTAL_API_BASE: import.meta.env.VITE_PORTAL_API_BASE as string | undefined,
  PROD: import.meta.env.PROD,
});

export class PortalError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const http = axios.create({ baseURL: PORTAL_API, withCredentials: true, timeout: 30_000 });
http.interceptors.response.use(
  (r) => r,
  (e: AxiosError<{ message?: string }>) =>
    Promise.reject(
      new PortalError(
        e.response?.data?.message || (e.response ? "Something went wrong. Please try again." : "Cannot reach the server. Check the connection."),
        e.response?.status ?? 0,
      ),
    ),
);

/** A document the API serves as a PDF. Opened as a link, so the sign-in cookie goes with it. */
export const pdfUrl = (path: string, query?: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(query ?? {}).filter((e): e is [string, string] => !!e[1]));
  return `${PORTAL_API}${path}${q.toString() ? `?${q}` : ""}`;
};

// ── What the server answers ────────────────────────────────────────
export type Stage = "received" | "confirmed" | "in_production" | "completed" | "cancelled";
export type PortalRole = "buyer" | "accountant" | "viewer";

export interface Me {
  user: { _id: string; name: string; email: string; role: PortalRole };
  customer: { _id: string; name: string } | null;
}

export interface Summary {
  company: { name: string; phone?: string; email?: string };
  customer: { name: string };
  user: { name: string; role: PortalRole };
  orders: { open: number; dueSoon: number };
  lastDispatch: { id: string; dcNumber: string; date: string | null } | null;
  canSeeMoney: boolean;
  money?: { owed: number; overdue: number; invoices: number };
}

export interface OrderRow {
  id: string;
  orderNo: number | null;
  po: string;
  date: string;
  supplyDate: string;
  stage: Stage;
  lines: number;
  ordered: number;
  produced: number;
  dispatched: number;
}

export interface DispatchRow {
  id: string;
  dcNumber: string;
  date: string | null;
  status: "dispatched" | "delivered";
  deliveredOn: string | null;
  order: { id: string; orderNo: number | null; po: string } | null;
  quantity: number;
  items: { elastic: string | null; name: string; quantity: number; unit: string }[];
}

export interface DispatchDetail extends DispatchRow {
  vehicleNo: string;
  transporter: string;
  lrNumber: string;
  receivedBy: string;
}

export interface OrderLine {
  elastic: string;
  name: string;
  ordered: number;
  produced: number;
  dispatched: number;
  toCome: number;
}

export interface OrderDetail extends Omit<OrderRow, "lines" | "ordered" | "produced" | "dispatched"> {
  lines: OrderLine[];
  totals: { ordered: number; produced: number; dispatched: number; toCome: number };
  dispatches: DispatchRow[];
  hasCertificates: boolean;
}

export interface Certificate {
  elastic: string;
  name: string;
  job: string;
  checkedAt: string;
  checkedBy: string;
  results: { parameter: string; expected: string; measured: string; pass: boolean }[];
}

export interface Certificates {
  order: { id: string; orderNo: number | null; po: string } | null;
  dispatch?: { id: string; dcNumber: string; date: string | null };
  certificates: Certificate[];
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  orderNo: number | null;
  total: number;
  paid: number;
  credited: number;
  debited: number;
  owed: number;
  overdueDays: number;
  state: "paid" | "part_paid" | "due" | "overdue";
}

export interface StatementRow {
  date: string;
  particulars: string;
  type: string;
  number: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  side: string;
  memo: boolean;
}

export interface Statement {
  party: { name: string; gstin: string };
  from: string | null;
  to: string | null;
  opening: number;
  openingSide: string;
  closing: number;
  closingSide: string;
  rows: StatementRow[];
  owed: { total: number; overdue: number; ageing: Record<string, number> };
}

interface Paged {
  total: number;
  page: number;
  pages: number;
}

const get = async <T>(url: string, params?: Record<string, unknown>) => (await http.get<T>(url, { params })).data;

export const portal = {
  me: () => get<Me>("/auth/me"),
  signIn: async (email: string, password: string) => (await http.post("/auth/login", { email, password })).data,
  signOut: async () => {
    await http.post("/auth/logout");
  },
  summary: () => get<Summary>("/summary"),
  orders: (status: "open" | "closed" | "all", page = 1) =>
    get<Paged & { orders: OrderRow[] }>("/orders", { status, page }),
  order: (id: string) => get<{ order: OrderDetail }>(`/orders/${id}`).then((r) => r.order),
  orderCertificates: (id: string) => get<Certificates>(`/orders/${id}/certificates`),
  dispatches: (page = 1, limit = 20) => get<Paged & { dispatches: DispatchRow[] }>("/dispatches", { page, limit }),
  dispatch: (id: string) => get<{ dispatch: DispatchDetail }>(`/dispatches/${id}`).then((r) => r.dispatch),
  dispatchCertificates: (id: string) => get<Certificates>(`/dispatches/${id}/certificates`),
  invoices: (status: "open" | "all", page = 1) =>
    get<Paged & { invoices: InvoiceRow[]; totals: { owed: number; overdue: number } }>("/invoices", { status, page }),
  statement: (from?: string, to?: string) => get<Statement>("/statement", { from, to }),
};
