import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TallyTab } from "./TallyTab";
import type { TallyPreview } from "./types";

// Exporting month by month: a bill entered late for a month already sent
// is dated before every period chosen afterwards, and never went. The
// preview now says so, and one click widens the period to take it.

const base: TallyPreview = { from: "2026-08-01", to: "2026-08-31", counts: {}, vouchers: 0, alreadySent: 0, ledgers: [], problems: [], sample: [] };
const tallyPreview = vi.fn(async (_range: { from: string; to: string }): Promise<TallyPreview> => base);
vi.mock("./api", () => ({
  accountsService: {
    tallyPreview: (r: { from: string; to: string }) => tallyPreview(r),
    tallyBatches: async () => [], tallyConnector: async () => ({ configured: false }), tallyReconcile: async () => null,
  },
}));
vi.mock("./TallyLink", () => ({ ConnectorCard: () => null, ReconcileCard: () => null }));
vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = () => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><TallyTab /></MemoryRouter></QueryClientProvider>);

describe("the Tally export's preview", () => {
  it("says when documents dated before the period have not gone, and widens the period to take them", async () => {
    tallyPreview.mockImplementation(async (r) => (r.from === "2026-07-20" ? { ...base, counts: { Purchase: 1 }, vouchers: 1, earlier: { count: 0, oldest: null } } : { ...base, earlier: { count: 1, oldest: "2026-07-20T00:00:00.000Z" } }));
    wrap();
    const note = await screen.findByRole("note", { name: "Earlier documents not sent" });
    expect(note).toHaveTextContent(/1 document dated before .* has not gone to Tally \(the oldest is dated 20 Jul 2026\)/);
    await userEvent.click(screen.getByRole("button", { name: "Export from 20 Jul 2026" }));
    expect(tallyPreview).toHaveBeenLastCalledWith(expect.objectContaining({ from: "2026-07-20" }));
    expect(await screen.findByText("Purchase")).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Earlier documents not sent" })).not.toBeInTheDocument();
  });

  it("says nothing when there are none, or the server is an older one", async () => {
    tallyPreview.mockImplementation(async () => base);
    wrap();
    expect(await screen.findByText(/Nothing new in this period/)).toBeInTheDocument();
    expect(screen.queryByRole("note", { name: "Earlier documents not sent" })).not.toBeInTheDocument();
  });
});
