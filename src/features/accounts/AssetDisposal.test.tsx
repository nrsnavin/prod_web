import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegistersTab } from "./RegistersTab";
import type { FixedAssetRegister, FixedAssetRow, JournalDraft } from "./types";

// An asset sold or scrapped leaves the register at once, and the books
// only when its journal is posted. The register says which it is, the
// journal comes drafted (cost and depreciation off, the profit or loss
// on it), and it is kept one an asset: posted again unchanged it is
// answered by the one already there.

const year = (disposal: FixedAssetRow["year"]["disposal"] = null) => ({ fy: "2027-28", days: 183, fraction: 0.5, halfRate: false, companiesAct: { opening: 400000, depreciation: 36000, closing: disposal ? 0 : 364000, rate: 18.1, method: "wdv" as const }, incomeTax: { opening: 425000, depreciation: disposal ? 0 : 63750, closing: disposal ? 125000 : 361250, rate: 15 }, disposal });
const asset = (over: Partial<FixedAssetRow>): FixedAssetRow => ({ _id: "fa1", assetNo: "FA/2026-27/0001", name: "Old loom", block: "plant", method: "wdv", residualPercent: 5, purchaseDate: "2026-04-01", putToUse: "2026-04-01", cost: 500000, status: "active", year: year(), blockLabel: "Plant & machinery", addedThisYear: false, ...over });
const gone = { date: "2027-09-30", amount: 300000, wdv: 364000, gainLoss: -64000, itBlockAfter: 125000, itGain: 0 };
const register = (rows: FixedAssetRow[]): FixedAssetRegister => ({
  fy: "2027-28", from: "2027-04-01", to: "2028-03-31", rows, blocks: [],
  totals: { cost: 500000, caOpening: 400000, caDep: 36000, caClosing: 364000, itOpening: 425000, itDep: 63750, itClosing: 361250, additions: 0, disposals: 0 },
  journal: null, journalStale: false, timingDifference: 0, blockTable: [{ key: "plant", label: "Plant & machinery", itRate: 15, life: 15 }],
});
const draft: JournalDraft = {
  date: "2027-09-30T00:00:00.000Z", purpose: "other", narration: "FA/2026-27/0001 Old loom sold for ₹300000.00: cost ₹500000.00, written-down value ₹364000.00", reason: "FA/2026-27/0001 sold: Replaced",
  lines: [
    { kind: "ledger", ledger: "Accumulated Depreciation", debit: 136000, credit: 0, note: "Depreciation on it up to the day it went" },
    { kind: "bank", account: null, debit: 300000, credit: 0, note: "What it was sold for: pick the account the money came into" },
    { kind: "ledger", ledger: "Loss on Sale of Fixed Assets", debit: 64000, credit: 0, note: "Sold for less than its written-down value" },
    { kind: "ledger", ledger: "Plant & machinery", debit: 0, credit: 500000, note: "Its cost, off the asset ledger (use the ledger it was bought into)" },
  ],
  figures: { cost: 500000, accumulated: 136000, wdv: 364000, amount: 300000, gainLoss: -64000 }, posted: null,
};

let registerNow: FixedAssetRegister;
let draftNow: JournalDraft;
const disposeFixedAsset = vi.fn();
const disposalJournal = vi.fn();
const postDisposalJournal = vi.fn();
vi.mock("./api", () => ({
  accountsService: {
    fixedAssets: async () => registerNow, fixedAssetsXlsxUrl: () => "#",
    disposeFixedAsset: (...a: unknown[]) => disposeFixedAsset(...a),
    disposalJournal: (...a: unknown[]) => disposalJournal(...a),
    postDisposalJournal: (...a: unknown[]) => postDisposalJournal(...a),
  },
}));
vi.mock("./hooks", () => ({
  ACCOUNTS_KEY: "accounts",
  useAccountsMutations: () => ({ createJournal: { mutate: vi.fn(), isPending: false } }),
  useCategories: () => ({ data: [] }),
  useOpenDocs: () => ({ data: { docs: [], balance: 0 } }),
  useBankAccounts: () => ({ data: [{ _id: "b1", name: "Kotak CA", kind: "bank", active: true, isDefault: true }, { _id: "cash", name: "Cash box", kind: "cash", active: true }] }),
}));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const wrap = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><RegistersTab /></MemoryRouter></QueryClientProvider>);
const row = async () => within(await screen.findByRole("table", { name: "Fixed asset register" })).getByText("Old loom").closest("tr")!;

beforeEach(() => {
  disposeFixedAsset.mockReset(); disposalJournal.mockReset(); postDisposalJournal.mockReset(); toast.mockReset();
  registerNow = register([asset({})]);
  draftNow = draft;
  disposalJournal.mockImplementation(async () => draftNow);
});

describe("an asset sold", () => {
  it("has its journal drafted as soon as the sale is recorded, and posts once the account is picked", async () => {
    disposeFixedAsset.mockImplementation(async () => {
      registerNow = register([asset({ status: "sold", year: year(gone), disposalJournal: null })]);
      return { success: true, asset: { ...asset({}), status: "sold" }, year: year(gone), journal: draft };
    });
    postDisposalJournal.mockImplementation(async () => {
      registerNow = register([asset({ status: "sold", year: year(gone), disposalJournal: { _id: "j9", journalNo: "JV/2027-28/0004", date: "2027-09-30", total: 500000 } })]);
      return { success: true, journal: { _id: "j9", journalNo: "JV/2027-28/0004" }, replaced: null };
    });
    wrap();
    await userEvent.click(within(await row()).getByRole("button", { name: "Sold / scrapped" }));
    await userEvent.type(await screen.findByLabelText("Sold for (₹)"), "300000");
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    // The journal screen opens, worked from the register's figures.
    const figures = await screen.findByLabelText("What the journal is worked from");
    expect(figures).toHaveTextContent("Cost₹5,00,000.00");
    expect(figures).toHaveTextContent("Written-down value₹3,64,000.00");
    expect(figures).toHaveTextContent("Loss₹64,000.00");
    expect(screen.getByText(/Nothing is in the books for FA\/2026-27\/0001 yet/)).toBeInTheDocument();
    // Dated the day it went, and filed as what it is: neither is for the person to change.
    expect(screen.getByLabelText("Date")).toHaveValue("2027-09-30");
    expect(screen.getByLabelText("Date")).toBeDisabled();
    expect(screen.getByText("What it was sold for: pick the account the money came into")).toBeInTheDocument();
    expect(screen.getByText(/Debits/).parentElement).toHaveTextContent("balanced");

    // No account for the money yet: it cannot be posted.
    const postButton = screen.getByRole("button", { name: "Post journal" });
    expect(postButton).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Account"), "b1");
    expect(postButton).toBeEnabled();
    await userEvent.click(postButton);

    await waitFor(() => expect(postDisposalJournal).toHaveBeenCalledTimes(1));
    const [id, body] = postDisposalJournal.mock.calls[0] as [string, { lines: Array<Record<string, unknown>>; narration: string; reason: string }];
    expect(id).toBe("fa1");
    expect(body.reason).toBe("FA/2026-27/0001 sold: Replaced");
    expect(body.narration).toMatch(/Old loom sold for ₹300000\.00/);
    expect(body.lines.map((l) => [l.kind, l.ledger ?? l.account, l.debit, l.credit])).toEqual([
      ["ledger", "Accumulated Depreciation", 136000, 0],
      ["bank", "b1", 300000, 0],
      ["ledger", "Loss on Sale of Fixed Assets", 64000, 0],
      ["ledger", "Plant & machinery", 0, 500000],
    ]);
    await waitFor(() => expect(toast).toHaveBeenCalledWith("JV/2027-28/0004 posted", "success"));
    // Back on the register it carries its journal.
    expect(await within(await row()).findByText("JV/2027-28/0004")).toBeInTheDocument();
  });

  it("says on the register that it is not in the books until its journal is posted", async () => {
    registerNow = register([asset({ status: "sold", year: year(gone), disposalJournal: null })]);
    wrap();
    const r = await row();
    expect(r).toHaveTextContent("sold · loss ₹64,000.00");
    await userEvent.click(within(r).getByRole("button", { name: "Post FA/2026-27/0001's journal" }));
    expect(disposalJournal).toHaveBeenCalledWith("fa1");
    expect(await screen.findByLabelText("What the journal is worked from")).toBeInTheDocument();
  });

  it("posted again unchanged, is answered by the journal already there", async () => {
    registerNow = register([asset({ status: "sold", year: year(gone), disposalJournal: { _id: "j9", journalNo: "JV/2027-28/0004", date: "2027-09-30", total: 500000 } })]);
    draftNow = { ...draft, posted: { _id: "j9", journalNo: "JV/2027-28/0004", date: "2027-09-30", total: 500000 } };
    postDisposalJournal.mockResolvedValue({ success: true, journal: { _id: "j9", journalNo: "JV/2027-28/0004" }, replaced: null, replay: true });
    wrap();
    const r = await row();
    expect(within(r).getByText("JV/2027-28/0004")).toBeInTheDocument();
    expect(within(r).queryByRole("button", { name: /Not in the books/ })).not.toBeInTheDocument();
    await userEvent.click(within(r).getByRole("button", { name: "Post FA/2026-27/0001's journal again" }));
    expect(await screen.findByText(/JV\/2027-28\/0004 is in the books for FA\/2026-27\/0001/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Account"), "b1");
    await userEvent.click(screen.getByRole("button", { name: "Post journal" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("JV/2027-28/0004 is already in the books for it — nothing posted again", "info"));
  });

  it("says which journal a changed one took the place of, and keeps the screen open when the server refuses", async () => {
    registerNow = register([asset({ status: "sold", year: year(gone), disposalJournal: { _id: "j9", journalNo: "JV/2027-28/0004", date: "2027-09-30", total: 500000 } })]);
    postDisposalJournal.mockRejectedValueOnce(new Error("A journal above ₹1,00,000 needs an admin to post it"));
    postDisposalJournal.mockResolvedValueOnce({ success: true, journal: { _id: "j10", journalNo: "JV/2027-28/0007" }, replaced: "JV/2027-28/0004" });
    wrap();
    await userEvent.click(within(await row()).getByRole("button", { name: "Post FA/2026-27/0001's journal again" }));
    await userEvent.selectOptions(await screen.findByLabelText("Account"), "cash");
    await userEvent.click(screen.getByRole("button", { name: "Post journal" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Could not post", "error"));
    // Still open, with what was filled in.
    expect(screen.getByLabelText("Account")).toHaveValue("cash");
    await userEvent.click(screen.getByRole("button", { name: "Post journal" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("JV/2027-28/0007 posted, in place of JV/2027-28/0004", "success"));
  });
});
