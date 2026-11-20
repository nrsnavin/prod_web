import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatutoryTab } from "./StatutoryTab";
import type { Gstr2bSummary } from "./types";

// A GSTR-2B file says which month it is for, and the server files it
// there. Looking at October and uploading September's file, the screen
// said "N lines read" and showed October unchanged: where they went was
// not said.

const empty = (period: string): Gstr2bSummary => ({
  period, uploaded: false, uploadedAt: null,
  counts: { entries: 0, matched: 0, mismatch: 0, notInBooks: 0, missing: 0 }, itc: { matched: 0, mismatch: 0, notInBooks: 0, missing: 0, unavailable: 0 },
  rows: [], missing: [],
});
const read = (period: string): Gstr2bSummary => ({ ...empty(period), uploaded: true, uploadedAt: "2026-11-12T05:00:00Z", counts: { entries: 14, matched: 12, mismatch: 0, notInBooks: 2, missing: 0 } });
const uploadGstr2b = vi.fn();
const toast = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    gstr2b: async (period: string) => empty(period), gstr2bFollowUps: async () => [],
    uploadGstr2b: (...a: unknown[]) => uploadGstr2b(...a),
  },
}));
vi.mock("./hooks", () => ({ ACCOUNTS_KEY: "accounts", useAccountsMutations: () => ({}), useBankAccounts: () => ({ data: [] }), useCategories: () => ({ data: [] }), useOpenDocs: () => ({ data: { docs: [], balance: 0 } }) }));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const show = (url: string) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><StatutoryTab /></MemoryRouter></QueryClientProvider>);
const file = () => new File(["{}"], "returns_R2B.json", { type: "application/json" });

beforeEach(() => { uploadGstr2b.mockReset(); toast.mockReset(); });

describe("uploading a GSTR-2B file", () => {
  it("says which month it was filed under when that is not the month on screen", async () => {
    uploadGstr2b.mockResolvedValue(read("2026-09"));
    show("/accounts/statutory?section=gstr2b&month=2026-10");
    await userEvent.upload(await screen.findByLabelText("GSTR-2B JSON"), file());
    expect(uploadGstr2b).toHaveBeenCalledWith(expect.any(File), "2026-10");
    // Before: "14 lines read: …" and nothing about the month.
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^This file is the GSTR-2B for September 2026, and was filed there — October 2026 is unchanged\. 14 lines read/), "info");
  });

  it("says only what was read when it is the month on screen (unchanged)", async () => {
    uploadGstr2b.mockResolvedValue(read("2026-10"));
    show("/accounts/statutory?section=gstr2b&month=2026-10");
    await userEvent.upload(await screen.findByLabelText("GSTR-2B JSON"), file());
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^14 lines read: 12 matched/), "success");
  });
});

describe("a month in the link", () => {
  it("is taken when it is a month, and last month when it only looks like one", async () => {
    show("/accounts/statutory?section=gstr2b&month=2026-10");
    expect(await screen.findByLabelText("Month")).toHaveValue("2026-10");
  });

  it("the thirteenth month is not one", async () => {
    show("/accounts/statutory?section=gstr2b&month=2026-13");
    // Before: the screen was headed "GSTR-2B · January 2027".
    const heading = await screen.findByRole("heading", { name: /^GSTR-2B · / });
    expect(heading).not.toHaveTextContent("January 2027");
  });
});
