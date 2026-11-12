import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpeningTab } from "./OpeningTab";
import type { OpeningImportRow } from "./types";

// Opening balances from a spreadsheet. The server knows a balance by
// what it is — whose, which side, its date, reference and amount — so
// the same file posted again finds its rows already there. The screen
// says which rows those were, and does not count them as posted. (The
// id used to be the file's name, the line and the amount: the same file
// under another name doubled every balance.)

const row = (line: number, partyName: string, refNo: string, amount: number): OpeningImportRow => ({
  line, partyType: "customer", party: `c${line}`, partyName, refNo, date: "2026-03-31", dueDate: null, amount, kind: "due", problem: null,
} as OpeningImportRow);
const importOpening = vi.fn();
const bulk = vi.fn();
vi.mock("./api", () => ({ accountsService: { importOpening: (...a: unknown[]) => importOpening(...a), openingTemplateUrl: "#" } }));
vi.mock("./hooks", () => ({
  useOpeningBalances: () => ({ data: { rows: [], total: 0, pages: 1, totals: { customer: { due: 0, advance: 0 }, supplier: { due: 0, advance: 0 } } }, isLoading: false }),
  useAccountsMutations: () => ({ bulkOpening: { mutate: bulk, isPending: false }, cancelOpening: { mutate: vi.fn(), isPending: false }, createOpening: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const open = async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><OpeningTab /></MemoryRouter></QueryClientProvider>);
  await userEvent.click(screen.getByRole("button", { name: /Import from Excel/ }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.upload(within(dialog).getByLabelText("Balances file"), new File(["x"], "debtors.xlsx"));
  await within(dialog).findByText("Kumar Knits");
  return dialog;
};

beforeEach(() => {
  importOpening.mockReset(); bulk.mockReset(); toast.mockReset();
  importOpening.mockResolvedValue({ file: "debtors.xlsx", ok: 3, problems: 0, rows: [row(2, "Kumar Knits", "INV-1182", 30000), row(3, "Sunrise Garments", "INV-1190", 18500), row(4, "Bharat Knits", "", 12000)] });
});

describe("opening balances from a spreadsheet", () => {
  it("says which rows were already in the books, and does not count them as posted", async () => {
    bulk.mockImplementation((_rows, opts: { onSuccess: (r: unknown) => void }) => opts.onSuccess({
      success: true, posted: 3, failed: 0,
      results: [{ index: 0, ok: true, docNo: "OB/2025-26/0003", replay: true }, { index: 1, ok: true, docNo: "OB/2025-26/0011" }, { index: 2, ok: true, docNo: "OB/2025-26/0004", replay: true }],
    }));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Post 3 balances" }));
    expect(bulk.mock.calls[0][0]).toHaveLength(3);
    expect(within(dialog).getByText("Kumar Knits").closest("tr")).toHaveTextContent("already there as OB/2025-26/0003");
    expect(within(dialog).getByText("Sunrise Garments").closest("tr")).toHaveTextContent("OB/2025-26/0011");
    expect(within(dialog).getByText("Sunrise Garments").closest("tr")).not.toHaveTextContent("already there");
    expect(within(dialog).getByText("Bharat Knits").closest("tr")).toHaveTextContent("already there as OB/2025-26/0004");
    expect(toast).toHaveBeenCalledWith("1 posted · 2 already in the books, not posted again", "info");
    // Posted once from this dialog: the button does not offer it again.
    expect(within(dialog).getByRole("button", { name: "Post 3 balances" })).toBeDisabled();
  });

  it("a first import reads as it always did", async () => {
    bulk.mockImplementation((_rows, opts: { onSuccess: (r: unknown) => void }) => opts.onSuccess({
      success: true, posted: 2, failed: 1,
      results: [{ index: 0, ok: true, docNo: "OB/2025-26/0001" }, { index: 1, ok: true, docNo: "OB/2025-26/0002" }, { index: 2, ok: false, error: "The books are locked up to 31 Mar 2026" }],
    }));
    const dialog = await open();
    await userEvent.click(within(dialog).getByRole("button", { name: "Post 3 balances" }));
    expect(within(dialog).getByText("Bharat Knits").closest("tr")).toHaveTextContent("✗ The books are locked up to 31 Mar 2026");
    expect(toast).toHaveBeenCalledWith("2 posted, 1 failed", "info");
  });
});
