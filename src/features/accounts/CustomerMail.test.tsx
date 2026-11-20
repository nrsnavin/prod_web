import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerMail } from "./CustomerMail";

const get = vi.fn(); const post = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));
const wrap = () => render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><CustomerMail /></QueryClientProvider></MemoryRouter>);

describe("CustomerMail", () => {
  it("is hidden until the mailbox is set up", async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith("/status") ? { configured: false } : { rows: [] }));
    wrap();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/customer mail/i)).not.toBeInTheDocument();
  });

  it("shows what is waiting, where to finish it, and marks it done", async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith("/status") ? { configured: true, mailbox: "orders@balu.in", everyMin: 10 } : { rows: [
      { _id: "m1", from: "someone@gmail.com", subject: "Order for 5000 m", receivedAt: "2026-11-09T05:00:00Z", customerName: "", kind: "purchase_order", summary: "", status: "new", note: "Sender not matched to a customer — open it and pick one", files: [] },
      { _id: "m2", from: "accounts@tk.in", subject: "Payment advice", receivedAt: "2026-11-09T05:00:00Z", customerName: "Tirupur Knits", kind: "payment_advice", summary: "", status: "done", note: "", files: [] },
    ] }));
    post.mockResolvedValue({});
    wrap();
    expect(await screen.findByText(/1 to look at/)).toBeInTheDocument();
    expect(screen.getByText(/not matched to a customer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /confirm under orders/i })).toHaveAttribute("href", "/orders");
    expect(screen.queryByText("Tirupur Knits")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(post).toHaveBeenCalledWith("/accounts/customer-mail/m1/done", {});
  });

  // The count was of the rows listed, and the list was the newest 200 mails:
  // what had waited longest was the first to stop being counted. The server
  // now counts the mailbox, and the screen says its count.
  it("says how many are waiting as the server counts them, and when the list is not all of them", async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith("/status") ? { configured: true, mailbox: "orders@balu.in", everyMin: 10 } : { waiting: 503, rows: [
      { _id: "m1", from: "someone@gmail.com", subject: "Order for 5000 m", receivedAt: "2026-11-09T05:00:00Z", customerName: "", kind: "purchase_order", summary: "", status: "new", note: "", files: [] },
    ] }));
    wrap();
    expect(await screen.findByText(/503 to look at/)).toBeInTheDocument();
    expect(screen.getByText("The newest 1 of 503 waiting are listed.")).toBeInTheDocument();
  });

  it("an answer with no count is counted from the list, as before", async () => {
    get.mockImplementation((url: string) => Promise.resolve(url.endsWith("/status") ? { configured: true, mailbox: "orders@balu.in", everyMin: 10 } : { rows: [
      { _id: "m1", from: "a@b.in", subject: "Order", receivedAt: "2026-11-09T05:00:00Z", customerName: "", kind: "purchase_order", summary: "", status: "new", note: "", files: [] },
    ] }));
    wrap();
    expect(await screen.findByText(/1 to look at/)).toBeInTheDocument();
    expect(screen.queryByText(/waiting are listed/)).not.toBeInTheDocument();
  });
});
