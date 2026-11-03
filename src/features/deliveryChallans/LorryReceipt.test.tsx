import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LorryReceiptDialog } from "./LorryReceiptDialog";

// The lorry receipt read onto the challan; what does not fit is said;
// the freight of a transporter not registered for GST opens as a
// service bill under reverse charge.

const saveTransport = vi.fn(async () => ({ success: true }));
vi.mock("./api", () => ({
  dcService: {
    scanLr: async () => ({
      read: { problem: null, lrNumber: "TPR/4471", lrDate: "2026-11-02", vehicleNo: "TN38AB1234", transporterName: "VRL Logistics", transporterGstin: "", consignee: "Sunrise", destination: "Erode", packages: 14, weightKg: 320, freight: 4200, paidBy: "paid", confidence: 0.8 },
      transporter: { _id: "s9", name: "VRL Logistics", gstRegistration: "unregistered" },
      checks: ["The LR is dated 2026-11-12, 11 days after the challan."],
      aiSuggestion: "ai3",
    }),
    saveTransport: (...a: unknown[]) => saveTransport(...(a as [])),
  },
}));
vi.mock("@/features/accounts/api", () => ({ accountsService: { categories: async () => [{ _id: "h1", name: "Transport & freight", active: true }] } }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

function Landed() {
  const s = useLocation().state as { reenter: { billKind?: string; reverseCharge?: boolean; category?: string; billNo: string; supplier?: { _id: string }; lines: Array<{ rate: number; gstPercent: number }> }; title: string };
  return <p data-testid="landed">{JSON.stringify({ path: useLocation().pathname, ...s.reenter, title: s.title })}</p>;
}

describe("the lorry receipt", () => {
  it("fills the transport, says what does not fit, saves it, and opens the freight as a reverse-charge bill", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/dc/d1"]}>
          <Routes>
            <Route path="/dc/d1" element={<LorryReceiptDialog dc={{ _id: "d1", dcNumber: "DC/2026-27/0007" }} onClose={() => {}} />} />
            <Route path="/accounts/bills" element={<Landed />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await userEvent.upload(screen.getByLabelText("Lorry receipt photo"), new File(["x"], "lr.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("11 days after the challan");
    expect(screen.getByLabelText("LR number")).toHaveValue("TPR/4471");
    expect(screen.getByLabelText("Freight (₹)")).toHaveValue(4200);
    expect(screen.getByText(/reverse charge applies/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save and enter the freight/i }));
    expect(saveTransport).toHaveBeenCalledWith("d1", expect.objectContaining({ lrNumber: "TPR/4471", vehicleNo: "TN38AB1234", transporter: "VRL Logistics", aiSuggestion: "ai3" }));
    const landed = JSON.parse((await screen.findByTestId("landed")).textContent || "{}");
    expect(landed).toMatchObject({ path: "/accounts/bills", billKind: "service", reverseCharge: true, category: "h1", billNo: "TPR/4471", supplier: { _id: "s9" } });
    expect(landed.lines[0]).toMatchObject({ rate: 4200, gstPercent: 5 });
  });
});
