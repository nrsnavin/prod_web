import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuditPage } from "./AuditPage";

// Changes to logins sit in the same feed as everything else: named,
// linked to the Users screen, and a deleted login named but not linked
// (it has no page any more). Quotes, stock counts and material groups,
// which the server already returned, now have names too.

vi.mock("./api", () => ({
  auditService: {
    recent: () =>
      Promise.resolve({
        success: true,
        count: 4,
        entries: [
          { entityType: "Login", entityId: "u1", entityNo: "Ravi Kumar", code: "PHONE_SIGNIN_RESET", label: "PIN Reset", shortId: "AAA", at: "2026-10-01T10:00:00Z", actor: { id: "a", name: "Owner", role: "admin" } },
          { entityType: "Login", entityId: "u2", entityNo: "Temp Login", code: "LOGIN_DELETED", label: "Login Deleted", shortId: "BBB", at: "2026-10-01T09:00:00Z", actor: { id: "a", name: "Owner", role: "admin" } },
          { entityType: "Quote", entityId: "q1", entityNo: 12, code: "QUOTE_CREATED", label: "Quotation Raised", shortId: "CCC", at: "2026-10-01T08:00:00Z", actor: null },
          { entityType: "MaterialGroup", entityId: "g1", entityNo: "WARP_YARN", code: "MATERIAL_GROUP_UPDATED", label: "Material Group Edited", shortId: "DDD", at: "2026-10-01T07:00:00Z", actor: null },
        ],
      }),
  },
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("the audit trail", () => {
  it("names login changes and links them to the Users screen", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "Login Ravi Kumar" });
    expect(link).toHaveAttribute("href", "/users");
    expect(screen.getByText("PIN Reset")).toBeInTheDocument();
  });

  it("names a deleted login without linking to it", async () => {
    renderPage();
    expect(await screen.findByText("Login Temp Login")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Login Temp Login" })).not.toBeInTheDocument();
  });

  it("names quotes and material groups", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: "Quote 12" })).toHaveAttribute("href", "/quotes/q1");
    expect(screen.getByRole("link", { name: "Material group WARP_YARN" })).toHaveAttribute("href", "/materials/groups");
  });
});
