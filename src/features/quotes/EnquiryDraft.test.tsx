import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnquiryDraft, productFromEnquiry, type EnquiryResult } from "./EnquiryDraft";

// The customer's message drafted into the quote, with why each margin.

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Files go through the shared upload (core/http/upload.ts), like every other request.
const upload = vi.fn();
vi.mock("@/core/http/upload", () => ({ uploadForm: (...a: unknown[]) => upload(...(a as [])) }));
afterEach(() => upload.mockReset());

const body: EnquiryResult = {
  read: { problem: null }, customer: { _id: "c1", name: "Sunrise Garments" }, aiSuggestion: "ai8",
  coverNote: "Dear Sunrise Garments,\n• 25mm Knitted Elastic - Black — 20,000 m at ₹3.90/m + GST",
  lines: [{ productName: "25mm Knitted Elastic - Black", productSpec: "25 mm · Black", elastic: "e25", quantityMetres: 20000, conversionCost: 1.25, marginPercent: 20, cost: 3.25, rate: 3.9, candidates: [],
    materials: [{ label: "Warp spandex — Spandex 840D", weightGrams: 1, ratePerKg: 900 }], reasons: ["They accepted 20% on Q/1 for this elastic.", "Declined at 12% before (Q/2) — they may push back."] }],
};

describe("a quote from an enquiry", () => {
  it("sends the message, shows the price and why, and hands the lines to the form", async () => {
    upload.mockResolvedValue(body);
    const onDraft = vi.fn();
    render(<EnquiryDraft onDraft={onDraft} />);
    await userEvent.type(screen.getByLabelText("Enquiry"), "Need 20000 m 25mm black");
    await userEvent.click(screen.getByRole("button", { name: /Draft the quote/ }));
    expect(upload).toHaveBeenCalledWith("/quote/from-enquiry", expect.any(FormData), expect.any(String));
    expect(await screen.findByText(/cost ₹3.25\/m, at 20% ₹3.90\/m/)).toBeInTheDocument();
    expect(screen.getByText("Declined at 12% before (Q/2) — they may push back.")).toBeInTheDocument();
    expect(screen.getByText(/20,000 m at ₹3.90\/m \+ GST/)).toBeInTheDocument();
    expect(onDraft).toHaveBeenCalledWith(body);
    expect(productFromEnquiry(body.lines[0])).toMatchObject({ productName: "25mm Knitted Elastic - Black", elastic: "e25", marginPercent: "20", quantityMetres: "20000", conversionCost: "1.25", materials: [expect.objectContaining({ label: "Warp spandex — Spandex 840D", weightGrams: "1", ratePerKg: "900" })] });
  });
});
