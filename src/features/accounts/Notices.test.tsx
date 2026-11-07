import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NoticesSection } from "./NoticesSection";

// A notice read from its PDF, its reply date kept; the register shows
// what is due soonest.

const post = vi.fn(async () => ({ data: { _id: "n9" } }));
vi.mock("@/core/http/httpClient", () => ({
  httpClient: {
    get: async () => ({ counts: { open: 1, overdue: 1, dueThisWeek: 0 }, data: [{ _id: "n1", authority: "pf", form: "", subject: "Late remittance", reference: "R-2", periodText: "", summary: "", documents: [], status: "open", daysLeft: -2, urgency: "overdue", replyBy: "2026-11-05" }] }),
    post: (...a: unknown[]) => post(...(a as [])), patch: vi.fn(),
  },
  ApiError: class extends Error {},
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

describe("government notices", () => {
  it("lists what is overdue and adds a notice read from its PDF, keeping the file", async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/read") ? {
      aiSuggestion: "ai5", already: null,
      read: { problem: null, authority: "gst", form: "ASMT-10", reference: "ZD331124001", subject: "ITC mismatch", periodText: "Apr 2024 – Mar 2025", amount: 184500, issuedOn: "2026-10-28", replyBy: "2026-11-27", replyByAssumed: true, summary: "ITC is more than 2B.", documents: ["GSTR-1 vs GSTR-3B for the period"] },
    } : { success: true } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<QueryClientProvider client={new QueryClient()}><NoticesSection /></QueryClientProvider>);
    expect(await screen.findByText("2 days overdue")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Add a notice/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.upload(within(dialog).getByLabelText("notice file"), new File(["%PDF"], "asmt10.pdf", { type: "application/pdf" }));
    expect(await within(dialog).findByLabelText("Reply by")).toHaveValue("2026-11-27");
    expect(within(dialog).getByText(/legal limit/)).toBeInTheDocument();
    expect(within(dialog).getByText("GSTR-1 vs GSTR-3B for the period")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Add to the register" }));
    expect(post).toHaveBeenCalledWith("/accounts/notices", expect.objectContaining({ form: "ASMT-10", reference: "ZD331124001", amount: 184500, replyBy: "2026-11-27", source: "photo", aiSuggestion: "ai5" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/accounts/notices/n9/attachments", expect.objectContaining({ method: "POST" }));
  });
});
