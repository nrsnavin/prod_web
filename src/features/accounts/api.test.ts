import { beforeEach, describe, expect, it, vi } from "vitest";

// The calls a screen makes straight to the server. A posting sent twice
// must be one event: it carries the same id while the same thing is
// being retried, and a new one once it has gone through. And what the
// server says beside its answer (a bill entered but its file not
// attached) reaches the screen.

const post = vi.fn();
const get = vi.fn();
vi.mock("@/core/http/httpClient", () => ({
  httpClient: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  apiUrl: (p: string) => `/api/v2${p}`,
}));
vi.mock("@/core/http/upload", () => ({ uploadForm: vi.fn() }));

import { accountsService } from "./api";

const idOf = (call: number) => (post.mock.calls[call][1] as { requestId: string }).requestId;

beforeEach(() => { post.mockReset(); get.mockReset(); });

describe("a posting sent from a screen", () => {
  it("carries one id while the same thing is tried again, and a new one once it has gone through", async () => {
    post.mockRejectedValueOnce(new Error("timeout"));
    post.mockResolvedValue({ success: true, expense: {}, voucher: { _id: "v1", voucherNo: "PAY/2026-27/0001" } });
    const body = { account: "a1", reference: "UTR1" };
    await expect(accountsService.payExpense("e1", body)).rejects.toThrow("timeout");
    await accountsService.payExpense("e1", body);
    expect(post.mock.calls[0][0]).toBe("/accounts/expenses/e1/pay");
    expect(post.mock.calls[0][1]).toMatchObject(body);
    expect(idOf(0)).toMatch(/\S{8,}/);
    // The retry is the same event: the server answers it with what the first made, if the first did land.
    expect(idOf(1)).toBe(idOf(0));
    // It went through: paying again is a new event.
    await accountsService.payExpense("e1", body);
    expect(idOf(2)).not.toBe(idOf(0));
  });

  it("is a different event for another expense, or with something changed", async () => {
    post.mockRejectedValue(new Error("timeout"));
    await accountsService.payExpense("e1", { account: "a1" }).catch(() => undefined);
    await accountsService.payExpense("e2", { account: "a1" }).catch(() => undefined);
    await accountsService.payExpense("e1", { account: "a2" }).catch(() => undefined);
    // Stopped for a risk and confirmed: not the request that was refused.
    await accountsService.payExpense("e1", { account: "a1", confirmRisk: true, riskNote: "Checked with the owner" }).catch(() => undefined);
    expect(new Set([0, 1, 2, 3].map(idOf)).size).toBe(4);
  });

  it("gives every such posting an id: a credit applied, a challan, a certificate, a statutory deposit", async () => {
    post.mockResolvedValue({ success: true });
    await accountsService.applyCredit({ source: { type: "AccountNote", id: "n1" }, allocations: [{ docType: "Invoice", doc: "i1", amount: 100 }] });
    await accountsService.addTdsChallan({ month: "2026-10", section: "194C", amount: 1000, depositedOn: "2026-11-07" } as Parameters<typeof accountsService.addTdsChallan>[0]);
    await accountsService.addTdsCertificate({ direction: "issued" } as unknown as Parameters<typeof accountsService.addTdsCertificate>[0]);
    await accountsService.addStatutoryDeposit({ month: "2026-10", kind: "pf", amount: 4200, depositedOn: "2026-11-15" } as Parameters<typeof accountsService.addStatutoryDeposit>[0]);
    expect(post.mock.calls.map((c) => c[0])).toEqual(["/accounts/credits/apply", "/accounts/tds/challans", "/accounts/tds/certificates", "/accounts/payroll-books/deposits"]);
    const ids = [0, 1, 2, 3].map(idOf);
    expect(ids.every((id) => typeof id === "string" && id.length >= 8)).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });
});

describe("what the server says beside its answer", () => {
  it("a bill entered with its file not attached comes back with the warning", async () => {
    post.mockResolvedValueOnce({ success: true, bill: { _id: "b1", billNo: "PB/2026-27/0009" }, warnings: ["The bill is entered, but the file that came by mail could not be attached to it — attach it by hand."] });
    const bill = await accountsService.createBill({ supplier: "s1" } as Parameters<typeof accountsService.createBill>[0]);
    expect(bill).toMatchObject({ _id: "b1", billNo: "PB/2026-27/0009", warnings: [expect.stringMatching(/could not be attached/)] });
    // Nothing to say: the bill as it is.
    post.mockResolvedValueOnce({ success: true, bill: { _id: "b2", billNo: "PB/2026-27/0010" } });
    expect(await accountsService.createBill({ supplier: "s1" } as Parameters<typeof accountsService.createBill>[0])).toEqual({ _id: "b2", billNo: "PB/2026-27/0010" });
  });
});

describe("the routes added with the fixes", () => {
  it("undoes a wrong match on a statement line, and cancels a deposit slip whole", async () => {
    post.mockResolvedValue({ success: true });
    await accountsService.unlinkLine("st1", 4);
    await accountsService.cancelDeposit("d1", "Entered against the wrong account");
    expect(post.mock.calls).toEqual([
      ["/accounts/bank/statements/st1/lines/4/unlink", {}],
      ["/accounts/deposits/d1/cancel", { reason: "Entered against the wrong account" }],
    ]);
  });

  it("drafts and posts the journal of an asset sold", async () => {
    get.mockResolvedValue({ success: true, journal: { date: "2027-09-30", lines: [], posted: null } });
    post.mockResolvedValue({ success: true, journal: { _id: "j1", journalNo: "JV/2027-28/0004" }, replaced: null });
    expect(await accountsService.disposalJournal("fa1")).toEqual({ date: "2027-09-30", lines: [], posted: null });
    expect(get.mock.calls[0][0]).toBe("/accounts/fixed-assets/fa1/disposal-journal");
    const lines = [{ kind: "ledger" as const, ledger: "Plant & machinery", debit: 0, credit: 500000 }];
    await accountsService.postDisposalJournal("fa1", { lines, reason: "FA/2026-27/0001 sold" });
    expect(post.mock.calls[0]).toEqual(["/accounts/fixed-assets/fa1/disposal-journal", { lines, reason: "FA/2026-27/0001 sold" }]);
  });

  it("reads the lock's history", async () => {
    get.mockResolvedValue({ success: true, history: [{ at: "2026-11-01T05:00:00Z", action: "locked" }] });
    await accountsService.lockHistory();
    expect(String(get.mock.calls[0][0])).toMatch(/^\/accounts\/.*lock/);
  });
});
