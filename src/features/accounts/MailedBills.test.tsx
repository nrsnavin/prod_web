import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MailedBills } from "./MailedBills";
import type { MailedBill } from "./types";

// Bills that came by mail: what was read and matched, opened as a bill, or dismissed.

const svc = {
  billMailboxStatus: vi.fn(),
  mailedBills: vi.fn(),
  readBillMailbox: vi.fn(),
  dismissMailedBill: vi.fn(),
  readyMailedBills: vi.fn(),
  createBill: vi.fn(),
  mailedBillFileUrl: (id: string) => `/api/v2/accounts/bill-inbox/${id}/file`,
};
vi.mock("./api", () => ({ accountsService: new Proxy({}, { get: (_t, k: string) => (svc as Record<string, unknown>)[k] }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const bill = (over: Partial<MailedBill> = {}): MailedBill => ({
  _id: "ib1", status: "new", note: "", from: "accounts@sriyarn.in", subject: "Invoice", receivedAt: "2026-11-04T10:00:00Z", filename: "SY-118.pdf", contentType: "application/pdf",
  supplier: "s1", supplierName: "Sri Yarn Traders", matchedBy: "gstin", senderKnown: true, alreadyEntered: null, grand: 19530, billNo: "SY/118", billDate: "2026-11-03", confidence: 0.9, kind: "bill", bill: null, ...over,
});
const wrap = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><MailedBills /></MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => { for (const f of Object.values(svc)) if (typeof f === "function" && "mockReset" in f) (f as ReturnType<typeof vi.fn>).mockReset(); toast.mockReset(); });

describe("bills by mail", () => {
  it("lists what was read, with who it matched and what to watch, to open as a bill or dismiss", async () => {
    svc.billMailboxStatus.mockResolvedValue({ success: true, configured: true, mailbox: "bills@baluelastics.com", everyMin: 10, waiting: 2 });
    svc.mailedBills.mockResolvedValue([bill(), bill({ _id: "ib2", supplier: null, supplierName: "New Mills", matchedBy: null, senderKnown: false, alreadyEntered: "PB/2026-27/0003", confidence: 0.4, billNo: "NM/9" })]);
    wrap();
    const card = await screen.findByLabelText("Bills by mail");
    expect(card).toHaveTextContent("Bills mailed to bills@baluelastics.com are read every 10 min, with those sent on WhatsApp.");
    const first = (await within(card).findByText(/Sri Yarn Traders/)).closest("li")!;
    expect(first).toHaveTextContent("supplier by GSTIN");
    expect(first).toHaveTextContent("from the supplier's address");
    expect(first).toHaveTextContent("₹19,530");
    expect(within(first).getByRole("link", { name: "Open as a bill" })).toHaveAttribute("href", "/accounts/bills?mailed=ib1");
    expect(within(first).getByRole("link", { name: "View" })).toHaveAttribute("href", "/api/v2/accounts/bill-inbox/ib1/file");
    const second = within(card).getByText(/New Mills/).closest("li")!;
    expect(second).toHaveTextContent("supplier not on file");
    expect(second).toHaveTextContent("already entered as PB/2026-27/0003");
    expect(second).toHaveTextContent("hard to read");

    svc.dismissMailedBill.mockResolvedValue({ success: true });
    await userEvent.click(within(second).getByRole("button", { name: "Dismiss" }));
    await userEvent.click(within(second).getByRole("button", { name: /not ours — dismiss/i }));
    expect(svc.dismissMailedBill).toHaveBeenCalledWith("ib2", "Not a bill for the books");
  });

  it("a bill sent on WhatsApp says who sent it", async () => {
    svc.billMailboxStatus.mockResolvedValue({ success: true, configured: false, mailbox: "", everyMin: 10, waiting: 1 });
    svc.mailedBills.mockResolvedValue([bill({ source: "whatsapp", sentByName: "Clerk", from: "+919100000003", senderKnown: false, filename: "whatsapp-4821.jpg" })]);
    wrap();
    const card = await screen.findByLabelText("Bills by mail");
    expect(card).toHaveTextContent("Bills sent on WhatsApp wait here.");
    expect((await within(card).findByText(/Sri Yarn Traders/)).closest("li")).toHaveTextContent("On WhatsApp from Clerk");
  });

  it("reads the mailbox on request, and says what came", async () => {
    svc.billMailboxStatus.mockResolvedValue({ success: true, configured: true, mailbox: "bills@x.in", everyMin: 10, waiting: 0 });
    svc.mailedBills.mockResolvedValue([]);
    svc.readBillMailbox.mockResolvedValue({ success: true, mails: 2, bills: 3, errors: [] });
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: /check the mailbox/i }));
    expect(toast).toHaveBeenCalledWith("3 bills read from 2 mails", "success");
  });

  it("is not shown when there is no mailbox and nothing waits", async () => {
    svc.billMailboxStatus.mockResolvedValue({ success: true, configured: false, mailbox: "", everyMin: 10, waiting: 0 });
    const { container } = wrap();
    await vi.waitFor(() => expect(svc.billMailboxStatus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(svc.mailedBills).not.toHaveBeenCalled();
  });
});

describe("mailed bills ready to enter in one click", () => {
  const readyBill = { _id: "ib1", summary: { supplierName: "Sri Yarn Traders", billNo: "SY/118", billDate: "2026-11-03", poNo: 612, receipts: 2, grand: 19530, einvoice: true }, body: { supplier: "s1", supplierBillNo: "SY/118", billDate: "2026-11-03", lines: [], requestId: "inbox-bill:ib1", inboxBill: "ib1" } };
  const open = async () => {
    svc.billMailboxStatus.mockResolvedValue({ success: true, configured: true, mailbox: "bills@x.in", everyMin: 10, waiting: 2 });
    svc.mailedBills.mockResolvedValue([bill({ ready: true, readyWhy: [] }), bill({ _id: "ib2", supplierName: "New Mills", billNo: "NM/9", ready: false, readyWhy: ['"Freight" is not on a goods receipt', "The reader was only 40% sure"] })]);
    wrap();
    return screen.findByLabelText("Bills by mail");
  };

  it("marks the ready one, says why the other needs a look", async () => {
    const card = await open();
    expect((await within(card).findByText(/Sri Yarn Traders/)).closest("li")).toHaveTextContent("ready: nothing left to check");
    expect(within(card).getByText(/New Mills/).closest("li")).toHaveTextContent('Needs a look: "Freight" is not on a goods receipt (and 1 more)');
  });

  it("shows the ready bills for a last look, then enters each through the bill route", async () => {
    svc.readyMailedBills.mockResolvedValue([readyBill]);
    svc.createBill.mockResolvedValue({ _id: "b1", billNo: "PB/2026-27/0040" });
    const card = await open();
    await userEvent.click(await within(card).findByRole("button", { name: "Enter 1 ready bill" }));
    const region = await within(card).findByRole("region", { name: "Ready bills" });
    expect(region).toHaveTextContent("This bill agrees with its supplier, PO receipts and totals. Enter it?");
    expect(region).toHaveTextContent("Sri Yarn Traders #SY/118");
    expect(region).toHaveTextContent("PO #612, 2 receipts · e-invoice");
    await userEvent.click(within(region).getByRole("button", { name: "Enter it" }));
    expect(svc.createBill).toHaveBeenCalledWith(readyBill.body);
    expect(toast).toHaveBeenCalledWith("1 bill entered", "success");
  });

  it("a bill the route refuses is named, the others still go in", async () => {
    const { ApiError } = await import("@/core/http/httpClient");
    const second = { ...readyBill, _id: "ib3", summary: { ...readyBill.summary, billNo: "SY/119" }, body: { ...readyBill.body, supplierBillNo: "SY/119", requestId: "inbox-bill:ib3" } };
    svc.readyMailedBills.mockResolvedValue([readyBill, second]);
    svc.createBill.mockResolvedValueOnce({ _id: "b1" }).mockRejectedValueOnce(new ApiError("A receipt on this bill is already on PB/2026-27/0040", 409));
    const card = await open();
    await userEvent.click(await within(card).findByRole("button", { name: "Enter 1 ready bill" }));
    await userEvent.click(within(await within(card).findByRole("region", { name: "Ready bills" })).getByRole("button", { name: "Enter these 2" }));
    expect(svc.createBill).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledWith("1 entered; 1 not: Sri Yarn Traders #SY/119: A receipt on this bill is already on PB/2026-27/0040", "error");
  });
});
