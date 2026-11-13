import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WhatsAppPhotos } from "./WhatsAppPhotos";
import type { WhatsAppPaper } from "./types";

// Photos sent on WhatsApp that wait for a person: a cheque to enter, a
// challan to receive, one nobody could tell — and a wrong sort put right.

const svc = {
  whatsappPapers: vi.fn(),
  routeWhatsappPaper: vi.fn(),
  dismissWhatsappPaper: vi.fn(),
  whatsappPaperFileUrl: (id: string) => `/api/v2/accounts/whatsapp-papers/${id}/file/0`,
};
vi.mock("./api", () => ({ accountsService: new Proxy({}, { get: (_t, k: string) => (svc as Record<string, unknown>)[k] }) }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const paper = (over: Partial<WhatsAppPaper>): WhatsAppPaper => ({
  _id: "p1", code: "4821", from: "+919800000000", who: "staff", sentByName: "Ravi", partyName: "", customer: null, supplier: null, caption: "", pages: 1,
  status: "waiting", kind: "other", kindBy: "model", summary: "", note: "", sentTo: null, entered: null, result: null, createdAt: "2026-11-13T05:00:00Z", decidedAt: null, ...over,
});
const cheque = paper({
  _id: "p1", kind: "cheque",
  result: {
    read: { problem: null, chequeNo: "004512", drawer: "SUNRISE GARMENTS" }, customer: { _id: "c1", name: "Sunrise Garments", matchedBy: "name" }, duplicate: null, aiSuggestion: "ai1",
    checks: [{ code: "WORDS", severity: "danger", message: "The words say ₹19,000; the figure says ₹19,530. A bank pays neither until they agree" }],
    draft: { kind: "receipt", partyType: "customer", customer: "c1", partyName: "Sunrise Garments", amount: 19530, mode: "cheque", reference: "004512", cheque: { number: "004512", bank: "HDFC Bank", date: "2026-11-20" }, postDated: true },
  },
});
const challan = paper({ _id: "p2", code: "4822", kind: "delivery_challan", result: { read: { supplierName: "Sri Yarn Traders", dcNo: "412" }, po: { _id: "po9", poNo: 118 }, rows: [{}, {}], aiSuggestion: null } });
const unknown = paper({ _id: "p3", code: "4823", kind: "other", summary: "a photo of a machine part" });

const wrap = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><WhatsAppPhotos /></MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => { for (const f of Object.values(svc)) if (typeof f === "function" && "mockReset" in f) (f as ReturnType<typeof vi.fn>).mockReset(); toast.mockReset(); });

describe("photos from WhatsApp", () => {
  it("lists what waits: a cheque to enter, a challan to receive on its PO, one nobody could tell", async () => {
    svc.whatsappPapers.mockResolvedValue({ success: true, papers: [cheque, challan, unknown], waiting: 3 });
    wrap();
    const card = await screen.findByLabelText("Photos from WhatsApp");
    expect(card).toHaveTextContent("3 to look at");
    const c = within(card).getByText(/Cheque 004512/).closest("li")!;
    expect(c).toHaveTextContent("Sunrise Garments · ₹19,530");
    expect(c).toHaveTextContent("(post-dated)");
    expect(c).toHaveTextContent("The words say ₹19,000");
    expect(within(c).getByRole("link", { name: "Enter the receipt" })).toHaveAttribute("href", "/accounts/vouchers?new=receipt&paper=p1");
    expect(within(c).getByRole("link", { name: "Photo" })).toHaveAttribute("href", "/api/v2/accounts/whatsapp-papers/p1/file/0");
    const d = within(card).getByText(/From Sri Yarn Traders/).closest("li")!;
    expect(d).toHaveTextContent("DC 412 · PO #118 · 2 lines");
    expect(within(d).getByRole("link", { name: "Receive on PO #118" })).toHaveAttribute("href", "/purchase-orders/po9?paper=p2");
    expect(within(card).getByText("a photo of a machine part").closest("li")).toHaveTextContent("Not sorted");
  });

  it("a wrong sort is put right; a photo not for the books is set aside", async () => {
    svc.whatsappPapers.mockResolvedValue({ success: true, papers: [unknown], waiting: 1 });
    svc.routeWhatsappPaper.mockResolvedValue({ ...unknown, kind: "supplier_bill", status: "done" });
    svc.dismissWhatsappPaper.mockResolvedValue({ ...unknown, status: "dismissed" });
    wrap();
    const row = (await screen.findByText("a photo of a machine part")).closest("li")!;
    await userEvent.selectOptions(within(row).getByLabelText("Photo 4823 is"), "supplier_bill");
    expect(svc.routeWhatsappPaper).toHaveBeenCalledWith("p3", "supplier_bill");
    expect(toast).toHaveBeenCalledWith("Photo 4823 sent on as supplier's bill", "success");
    await userEvent.click(within(row).getByRole("button", { name: "Set aside" }));
    expect(svc.dismissWhatsappPaper).toHaveBeenCalledWith("p3", "Not for the books");
  });

  it("is not shown when nothing waits", async () => {
    svc.whatsappPapers.mockResolvedValue({ success: true, papers: [], waiting: 0 });
    const { container } = wrap();
    await vi.waitFor(() => expect(svc.whatsappPapers).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
