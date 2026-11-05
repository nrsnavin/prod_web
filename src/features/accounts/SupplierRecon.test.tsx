import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SupplierRecon } from "./SupplierRecon";
import type { SupplierReconResult } from "./types";

// A supplier's statement beside our books: the balance difference, and every line that makes it.

const reconcileSupplier = vi.fn();
vi.mock("./api", () => ({ accountsService: { reconcileSupplier: (...a: unknown[]) => reconcileSupplier(...a) } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const result: SupplierReconResult = {
  read: { problem: null, partyName: "Sri Yarn Traders", from: "2026-07-01", to: "2026-09-30", entries: [] },
  recon: {
    supplier: { _id: "s1", name: "Sri Yarn Traders", gstin: "33AAAPS0001F1Z5" },
    period: { from: "2026-07-01", to: "2026-09-30" },
    matched: [
      { theirs: { date: "2026-07-04", docNo: "118", kind: "invoice", debit: 10500, credit: 0, narration: "" }, ours: [{ docType: "SupplierBill", doc: "b1", docNo: "PB/2026-27/0001", theirNo: "SY/118", date: "2026-07-04", debit: 0, credit: 10500, narration: "" }], by: "number", difference: 0 },
      { theirs: { date: "2026-07-20", docNo: "SY/119", kind: "invoice", debit: 5300, credit: 0, narration: "" }, ours: [{ docType: "SupplierBill", doc: "b2", docNo: "PB/2026-27/0002", theirNo: "SY/119", date: "2026-07-20", debit: 0, credit: 5250, narration: "" }], by: "number", difference: 50 },
      { theirs: { date: "2026-07-26", docNo: "UTR123", kind: "payment", debit: 0, credit: 10400, narration: "" }, alsoTheirs: { date: "2026-07-28", docNo: "", kind: "tds", debit: 0, credit: 100, narration: "" }, ours: [{ docType: "Payment", doc: "p1", docNo: "PV/2026-27/0001", theirNo: "", date: "2026-07-25", debit: 10500, credit: 0, narration: "" }], by: "two of theirs make one of ours", difference: 0 },
    ],
    onlyTheirs: [{ date: "2026-08-02", docNo: "SY/120", kind: "invoice", debit: 2100, credit: 0, narration: "", likely: "A bill of theirs not entered in our books" }],
    onlyOurs: [{ docType: "Payment", doc: "p2", docNo: "PV/2026-27/0002", theirNo: "", date: "2026-09-29", debit: 1000, credit: 0, narration: "", likely: "A payment of ours they have not booked yet (in transit)" }],
    balances: { ours: 4250, theirs: 7400, difference: 3150, explained: 3150, unexplained: 0 },
    gstinDiffers: false,
  },
};

describe("checking a supplier's statement", () => {
  it("shows the two balances, that the difference is explained, and each line that explains it", async () => {
    reconcileSupplier.mockResolvedValue(result);
    render(<MemoryRouter><SupplierRecon supplier="s1" name="Sri Yarn Traders" /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /check their statement/i }));
    const file = new File(["%PDF"], "ledger.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText("Their statement"), file);
    expect(reconcileSupplier).toHaveBeenCalledWith("s1", [file]);

    const balances = await screen.findByLabelText("Balances");
    expect(balances).toHaveTextContent("They say we owe₹7,400.00");
    expect(balances).toHaveTextContent("Our books say₹4,250.00");
    expect(balances).toHaveTextContent("Difference₹3,150.00");
    expect(balances).toHaveTextContent("all explained below");

    const theirs = screen.getByLabelText("Only in theirs");
    expect(theirs).toHaveTextContent("SY/120A bill of theirs not entered in our books");
    expect(within(theirs).getByRole("link", { name: "Enter it" })).toHaveAttribute("href", "/accounts/bills?scan=1");
    expect(screen.getByLabelText("Only in ours")).toHaveTextContent("in transit");
    const agreed = screen.getByLabelText("Agreed");
    expect(agreed).toHaveTextContent("UTR123 + tds= PV/2026-27/0001");
    expect(agreed).toHaveTextContent("₹50.00 more on theirs");
  });
});
