import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConeCountDialog } from "./ConeCount";

// Cones counted from a photo, turned into kg, checked, and put on the sheet.

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Files go through the shared upload (core/http/upload.ts), like every other request.
const upload = vi.fn();
vi.mock("@/core/http/upload", () => ({ uploadForm: (...a: unknown[]) => upload(...(a as [])) }));
afterEach(() => upload.mockReset());

describe("counting cones from a photo", () => {
  it("counts, works out the kg at the cone weight, lets the count be corrected, and puts it on the sheet", async () => {
    upload.mockResolvedValue({
      success: true, aiSuggestion: "ai9", material: { name: "40s PC Black", unit: "kg", coneWeightKg: 1.8 }, estimate: { quantity: 86.4, unit: "kg", basis: "48 cones × 1.8 kg" },
      read: { problem: null, cones: 48, rows: 6, perRow: 8, layers: 1, hidden: true, confidence: 0.6, note: "top shelf" },
    });
    const onUse = vi.fn();
    render(<ConeCountDialog countId="c1" lineId="l1" name="40s PC Black" onUse={onUse} onClose={() => {}} />);
    await userEvent.upload(screen.getByLabelText("cones photo"), new File([new Uint8Array([1])], "rack.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Counted 48 cones (6 rows × 8) · 60% sure · top shelf");
    expect(upload).toHaveBeenCalledWith("/stock-counts/c1/cones", expect.any(FormData), expect.any(String));
    expect(screen.getByText(/Some cones are hidden/)).toBeInTheDocument();
    expect(screen.getByLabelText(/One cone weighs/)).toHaveValue(1.8);
    expect(screen.getByText("86.4 kg on the sheet (48 × 1.8 kg)")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Cones"));
    await userEvent.type(screen.getByLabelText("Cones"), "52");
    await userEvent.click(screen.getByRole("button", { name: "Put 93.6 kg on the sheet" }));
    expect(onUse).toHaveBeenCalledWith({ countedQty: 93.6, cones: 52, aiSuggestion: "ai9" });
  });
});
