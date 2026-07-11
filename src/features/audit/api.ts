import { httpClient } from "@/core/http/httpClient";

// Mirrors GET /api/v2/audit/recent (prod/api/audit.js) — the plant-wide
// fingerprint feed across Orders, Jobs, POs and DCs.

export interface AuditEntry {
  entityType: "Order" | "JobOrder" | "PurchaseOrder" | "DeliveryChallan";
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
