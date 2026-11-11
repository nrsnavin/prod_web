import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  A CUSTOMER'S PORTAL LOGINS
//
//  The people at a customer who can sign in to the customer portal. The
//  office makes them (a customer cannot sign up alone), over
//  /customer/:id/portal-users on the server.
// ══════════════════════════════════════════════════════════════════

export type PortalRole = "buyer" | "accountant" | "viewer";

export interface PortalLogin {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: PortalRole;
  status: "active" | "disabled";
  lastLoginAt?: string | null;
  createdAt?: string;
}

export const PORTAL_ROLES: { value: PortalRole; label: string; sees: string }[] = [
  { value: "buyer", label: "Buyer", sees: "Orders, dispatches, certificates, invoices and the statement" },
  { value: "accountant", label: "Accountant", sees: "Orders, dispatches, certificates, invoices and the statement" },
  { value: "viewer", label: "Viewer", sees: "Orders, dispatches and certificates; no money" },
];

export const roleLabel = (r: PortalRole) => PORTAL_ROLES.find((x) => x.value === r)?.label ?? r;

// No 0/O, 1/l/I: the password is read out over the phone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A password to give the customer: 12 letters and digits in three groups. */
export function newPortalPassword(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}

export const portalLoginService = {
  async list(customerId: string): Promise<PortalLogin[]> {
    return (await httpClient.get<{ success: boolean; users: PortalLogin[] }>(`/customer/${customerId}/portal-users`)).users;
  },
  async create(customerId: string, body: { name: string; email: string; phone?: string; role: PortalRole; password: string }): Promise<PortalLogin> {
    return (await httpClient.post<{ success: boolean; user: PortalLogin }>(`/customer/${customerId}/portal-users`, body)).user;
  },
  async update(customerId: string, userId: string, body: Partial<{ status: "active" | "disabled"; password: string; role: PortalRole; name: string; phone: string }>) {
    return httpClient.patch<{ success: boolean; sessionsEnded: boolean; user: PortalLogin }>(`/customer/${customerId}/portal-users/${userId}`, body);
  },
  async remove(customerId: string, userId: string) {
    return httpClient.delete<{ success: boolean }>(`/customer/${customerId}/portal-users/${userId}`);
  },
};
