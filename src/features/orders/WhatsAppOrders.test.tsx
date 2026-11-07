import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WhatsAppOrders, draftOf, type OrderRequest } from "./WhatsAppOrders";

// What customers typed on WhatsApp, read and waiting: opened as an order
// (the form filled from it) or dismissed.

const req: OrderRequest = {
  _id: "r1", customer: "c1", customerName: "Sunrise Garments", createdAt: "2026-11-07T09:00:00Z",
  text: "Need 2000 m 25mm black and 1500 m 40mm white by 20th. PO SG/PO/91",
  draft: { poNumber: "SG/PO/91", deliveryDate: "2026-11-20", lines: [
    { description: "25mm Knitted Elastic Black", quantity: 2000, unit: "m", match: { elasticId: "e25", elasticName: "25mm Knitted Elastic Black" } },
    { description: "40mm Woven White", quantity: 1500, unit: "m", match: { elasticId: null, elasticName: null } },
  ] },
};
const get = vi.fn(async () => ({ success: true, requests: [req], count: 1 }));
const post = vi.fn(async () => ({ success: true }));
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...(a as [])), post: (...a: unknown[]) => post(...(a as [])) }, ApiError: class extends Error {} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const wrap = (onOpen = vi.fn()) => render(<QueryClientProvider client={new QueryClient()}><WhatsAppOrders onOpen={onOpen} /></QueryClientProvider>);

describe("WhatsApp orders", () => {
  it("shows what they typed and what was read, the unmatched lines to pick", async () => {
    const onOpen = vi.fn();
    wrap(onOpen);
    const row = await screen.findByLabelText("WhatsApp order from Sunrise Garments");
    expect(row).toHaveTextContent("“Need 2000 m 25mm black");
    expect(row).toHaveTextContent("2000 m · 25mm Knitted Elastic Black");
    expect(row).toHaveTextContent("1500 m · “40mm Woven White” — pick the elastic");
    expect(row).toHaveTextContent("PO SG/PO/91 · wanted by");
    await userEvent.click(within(row).getByRole("button", { name: "Open as order (1 to pick)" }));
    expect(onOpen).toHaveBeenCalledWith(req);
  });

  it("fills the order form from what was read", () => {
    expect(draftOf(req)).toEqual({
      customer: { id: "c1", name: "Sunrise Garments" }, po: "SG/PO/91", supplyDate: "2026-11-20",
      description: `From WhatsApp: ${req.text}`,
      lines: [{ elastic: "e25", elasticName: "25mm Knitted Elastic Black", quantity: 2000 }, { elastic: undefined, elasticName: undefined, quantity: 1500 }],
    });
  });

  it("is dismissed when it was not an order", async () => {
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: "Dismiss the message from Sunrise Garments" }));
    expect(post).toHaveBeenCalledWith("/order/requests/r1/dismissed", {});
  });
});
