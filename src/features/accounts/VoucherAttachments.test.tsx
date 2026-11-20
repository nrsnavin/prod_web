import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentDetailPage } from "./DocDetailPage";
import type { Payment } from "./types";

// A file attached to a voucher (the bank's advice, the signed receipt) was
// kept by the server and sent back with the voucher — and the page drew
// its list from nothing: "No bill or receipt attached yet", every time,
// straight after the toast that said "Attached".

const payment = {
  _id: "p1", kind: "payment", voucherNo: "PAY/2026-27/0031", date: "2026-11-10T00:00:00.000Z", partyType: "supplier", supplier: "s1", partyName: "Sri Yarn",
  amount: 5000, mode: "bank", account: "a1", accountName: "Kotak CA", tds: { amount: 0 }, allocations: [], unallocated: 0, status: "posted",
  attachments: [{ _id: "at1", filename: "kotak-advice.pdf", contentType: "application/pdf", size: 20480 }],
} as unknown as Payment;

vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  usePayment: () => ({ data: { payment }, isLoading: false, isError: false, error: null }),
  useAccountsMutations: () => new Proxy({}, { get: () => ({ mutate: vi.fn(), isPending: false }) }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "accounts" } }) }));

describe("a voucher's attachments", () => {
  it("are listed, each a link to the file", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/accounts/payments/p1"]}><Routes><Route path="/accounts/payments/:id" element={<PaymentDetailPage />} /></Routes></MemoryRouter>
      </QueryClientProvider>,
    );
    const link = screen.getByRole("link", { name: "kotak-advice.pdf" });
    expect(link.getAttribute("href")).toMatch(/\/accounts\/payments\/p1\/attachments\/at1$/);
    expect(screen.queryByText(/No bill or receipt attached yet/)).not.toBeInTheDocument();
  });
});
