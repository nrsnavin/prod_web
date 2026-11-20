import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JournalsList } from "./VouchersTab";
import type { Journal } from "./types";

// ════════════════════════════════════════════════════════════
//  A JOURNAL OPENED FROM A LEDGER
//
//  A party's ledger links each journal line to its journal
//  (?journal=<id>). The list looked for that journal among the rows on
//  its first page — so a link to this month's journal opened it, and a
//  link to last quarter's landed on the list with nothing open, as if
//  the click had done nothing.
// ════════════════════════════════════════════════════════════

const journal = (over: Partial<Journal>): Journal => ({
  _id: "j1", journalNo: "JV/2026-27/0050", date: "2026-11-10", purpose: "setoff", narration: "", reason: "Month-end set-off",
  lines: [{ ledger: "Sunrise Garments", debit: 0, credit: 500 }, { ledger: "Sri Yarn", debit: 500, credit: 0 }],
  total: 500, status: "posted", ...over,
} as Journal);

const older = journal({ _id: "j-old", journalNo: "JV/2026-27/0003", date: "2026-04-12", reason: "Opening correction" });

const byId = vi.fn(async (id: string) => {
  if (id === "j-gone") throw new Error("gone");
  return older;
});
vi.mock("./hooks", async (orig) => ({
  ...(await orig<typeof import("./hooks")>()),
  useJournals: () => ({ data: { journals: [journal({})], pages: 3, total: 50 }, isLoading: false }),
  useAccountsMutations: () => ({ cancelJournal: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("./api", () => ({ accountsService: { journal: (id: string) => byId(id) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = (open: string | null) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><JournalsList open={open} onOpen={() => {}} /></QueryClientProvider>);

describe("the journals list, asked for one journal", () => {
  it("opens one that is on the page without asking again", () => {
    wrap("j1");
    expect(screen.getByRole("table", { name: "Journal lines" })).toBeInTheDocument();
    expect(byId).not.toHaveBeenCalled();
  });

  it("fetches and opens one that is not on the page", async () => {
    wrap("j-old");
    await waitFor(() => expect(screen.getByRole("table", { name: "Journal lines" })).toBeInTheDocument());
    expect(byId).toHaveBeenCalledWith("j-old");
    expect(screen.getByText(/Opening correction/)).toBeInTheDocument();
    expect(screen.getByText(/JV\/2026-27\/0003/)).toBeInTheDocument();
  });

  it("says so when the one asked for cannot be found, rather than sitting silent", async () => {
    wrap("j-gone");
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not be opened/));
    expect(screen.queryByRole("table", { name: "Journal lines" })).not.toBeInTheDocument();
  });

  it("opens nothing when none is asked for", () => {
    wrap(null);
    expect(screen.queryByRole("table", { name: "Journal lines" })).not.toBeInTheDocument();
  });
});
