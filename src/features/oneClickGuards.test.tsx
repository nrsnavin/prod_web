import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ══════════════════════════════════════════════════════════════════
//  ONE PRESS ALONE NEVER DOES THE ACT
//
//  The actions that used to happen on a single press, page by page:
//  what can't be taken back asks first, in proportion — in place for a
//  small thing on one record, a dialog with its consequences for a
//  bigger one — and what can be taken back happens at once with an Undo.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

// ── Claims ─────────────────────────────────────────────────────────
const claims = vi.hoisted(() => ({ withdraw: vi.fn() }));
vi.mock("@/features/claims/api", () => ({
  claimsService: {
    categories: async () => [],
    mine: async () => ({ claims: [{ _id: "x1", expenseNo: "EXP/2026-27/0011", date: "2026-11-01", categoryName: "Fuel", description: "Diesel", totals: { grand: 800 }, status: "pending" }], owed: 0, waiting: 1 }),
    withdraw: claims.withdraw,
    create: vi.fn(), photo: vi.fn(), scan: vi.fn(),
  },
}));

// ── Bonus ──────────────────────────────────────────────────────────
const bonus = vi.hoisted(() => ({ payRecord: vi.fn() }));
vi.mock("@/features/hr/api", () => ({
  bonusService: {
    config: async () => ({ config: { year: 2026, status: "triggered", bonusDate: "2026-11-01" }, stats: { totalRecords: 1, paidRecords: 0, pendingRecords: 1, totalPayout: 12400 } }),
    records: async () => [{ _id: "b1", employee: { _id: "e1", name: "Ravi" }, year: 2026, bonusAmount: 12400, status: "pending" }],
    preview: async () => ({ configured: true, canGenerate: false, rows: [], totalPayout: 0 }),
    payRecord: bonus.payRecord,
    trigger: vi.fn(), resetYear: vi.fn(), saveConfig: vi.fn(),
  },
}));

// ── Books lock ─────────────────────────────────────────────────────
const lockBooks = vi.hoisted(() => vi.fn());
// One object, not a new one per render: the page copies the settings into
// its form in an effect keyed on them.
const books = vi.hoisted(() => ({
  settings: { data: { lockDate: "2026-09-30T00:00:00.000Z", lockedBy: "Owner" } },
  mutations: {} as Record<string, unknown>,
}));
vi.mock("@/features/accounts/hooks", () => ({
  useAccountsSettings: () => books.settings,
  useAccountsMutations: () => books.mutations,
}));

// ── Quotes ─────────────────────────────────────────────────────────
const quoteStatus = vi.hoisted(() => vi.fn());
vi.mock("@/features/quotes/hooks", () => ({
  useQuote: () => ({ data: { _id: "q1", quoteNo: "Q-26-0042", customerName: "Sunrise Garments", status: "draft", date: "2026-11-01", validTill: "2099-12-01", lines: [] }, isLoading: false, isError: false }),
  useQuoteMutations: () => ({ setStatus: { mutate: quoteStatus } }),
}));

// ── Covering ───────────────────────────────────────────────────────
const covering = vi.hoisted(() => ({ complete: vi.fn(), cancel: vi.fn() }));
vi.mock("@/features/warping/hooks", () => ({
  useCovering: () => ({ data: { _id: "c1", status: "in_progress", job: { _id: "j1", jobOrderNo: 12, customer: { name: "Ravi Textiles" } }, elasticPlanned: [], beamEntries: [] }, isLoading: false, isError: false }),
  useCoveringMutations: () => ({
    start: { mutate: vi.fn(), isPending: false },
    complete: { mutate: covering.complete, isPending: false },
    cancel: { mutate: covering.cancel, isPending: false },
    addBeam: { mutate: vi.fn(), isPending: false },
    deleteBeam: { mutate: vi.fn(), isPending: false },
    readSheet: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
    saveBeams: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/features/warping/CoveringLabels", () => ({ CoveringLabels: () => null }));
vi.mock("@/features/warping/CoveringBeamEntries", () => ({ CoveringBeamEntries: () => null }));

import { ClaimsPage } from "@/features/claims/ClaimsPage";
import { BonusPage } from "@/features/hr/BonusPage";
import { BooksSettings } from "@/features/accounts/BooksSettings";
import { QuoteDetailPage } from "@/features/quotes/QuoteDetailPage";
import { CoveringDetailPage } from "@/features/warping/CoveringDetailPage";

const wrap = (ui: ReactNode, path = "/", route = "/") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={route} element={ui} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

books.mutations = { lockBooks: { mutate: lockBooks, isPending: false }, saveAccountsSettings: { mutate: vi.fn(), isPending: false } };

beforeEach(() => {
  toast.mockReset();
  claims.withdraw.mockReset().mockResolvedValue({ success: true });
  bonus.payRecord.mockReset().mockResolvedValue({ success: true });
  lockBooks.mockReset();
  quoteStatus.mockReset();
  covering.complete.mockReset();
  covering.cancel.mockReset();
});

describe("withdrawing a claim", () => {
  it("asks in place with the amount; only the second press withdraws", async () => {
    wrap(<ClaimsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Withdraw…" }));
    expect(claims.withdraw).not.toHaveBeenCalled();
    expect(screen.getByText("Withdraw the ₹800.00 claim?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw claim" }));
    expect(claims.withdraw).toHaveBeenCalledWith("x1");
  });
});

describe("marking a bonus paid", () => {
  it("states the amount and person, and posts only on the second press", async () => {
    wrap(<BonusPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Mark paid…" }));
    expect(bonus.payRecord).not.toHaveBeenCalled();
    expect(screen.getByText("₹12,400 to Ravi?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark ₹12,400 paid" }));
    expect(bonus.payRecord.mock.calls[0][0]).toBe("b1");
  });
});

describe("closing the books", () => {
  it("asks with what stops working, and closes from the named button", async () => {
    wrap(<BooksSettings isAdmin />);
    const date = screen.getByLabelText("Close the books up to");
    await userEvent.clear(date);
    await userEvent.type(date, "2026-10-31");
    await userEvent.click(screen.getByRole("button", { name: /close books…/i }));
    expect(lockBooks).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/can be posted, edited or cancelled/);
    expect(dialog).toHaveTextContent(/Reopening later needs an admin and a reason/);
    await userEvent.click(within(dialog).getByRole("button", { name: /^close books to/i }));
    expect(lockBooks).toHaveBeenCalledWith({ lockDate: "2026-10-31" }, expect.anything());
  });
});

describe("a quote's status", () => {
  it("moves on one press, with an Undo that puts it back", async () => {
    wrap(<QuoteDetailPage />, "/quotes/q1", "/quotes/:id");
    await userEvent.click(screen.getByRole("button", { name: /mark sent/i }));
    expect(quoteStatus).toHaveBeenCalledWith({ id: "q1", status: "sent" }, expect.anything());
    quoteStatus.mock.calls[0][1].onSuccess();
    const [, , opts] = toast.mock.calls.find((c) => c[0] === "Marked as sent")!;
    expect(opts.action.label).toBe("Undo");
    opts.action.onClick();
    expect(quoteStatus).toHaveBeenLastCalledWith({ id: "q1", status: "draft" }, expect.anything());
  });
});

describe("covering", () => {
  it("completing asks first, saying it can't be reopened", async () => {
    wrap(<CoveringDetailPage />, "/covering/c1", "/covering/:id");
    await userEvent.click(screen.getByRole("button", { name: "Complete…" }));
    expect(covering.complete).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/can't be reopened/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Complete covering" }));
    expect(covering.complete).toHaveBeenCalledWith({ id: "c1" }, expect.anything());
  });

  it("cancelling asks why, and the reason goes with it", async () => {
    wrap(<CoveringDetailPage />, "/covering/c1", "/covering/:id");
    await userEvent.click(screen.getByRole("button", { name: "Cancel covering…" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel covering" }));
    expect(covering.cancel).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByRole("textbox"), "Wrong yarn count");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel covering" }));
    expect(covering.cancel).toHaveBeenCalledWith({ id: "c1", remarks: "Wrong yarn count" }, expect.anything());
  });
});
