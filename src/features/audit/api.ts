import { httpClient } from "@/core/http/httpClient";

// Mirrors GET /api/v2/audit/recent (prod/api/audit.js) — the plant-wide
// fingerprint feed across orders, jobs, POs, DCs, quotes, stock counts,
// material groups, and changes to logins.

export interface AuditEntry {
  entityType:
    | "Order"
    | "JobOrder"
    | "PurchaseOrder"
    | "DeliveryChallan"
    | "Quote"
    | "StockCount"
    | "MaterialGroup"
    /** An admin viewed an employee's full Aadhaar number. */
    | "Employee"
    /** A change to someone's access: login created, edited, deleted, PIN set. */
    | "Login";
  entityId: string;
  entityNo: string | number | null;
  code: string;
  label: string;
  shortId: string;
  at: string;
  actor: { id: string; name: string; role: string } | null;
  reason?: string | null;
}

export const auditService = {
  recent(limit = 100): Promise<{ success: boolean; count: number; entries: AuditEntry[] }> {
    return httpClient.get("/audit/recent", { limit });
  },
};
