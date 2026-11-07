import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InwardForm } from "./PoDetailPage";
import type { PoItem } from "./types";

// The supplier's challan and the cone labels fill the goods received:
// each line's quantity, lot and shade; a second lot of the same yarn, and
// anything not on this PO, listed to check.

const items: PoItem[] = [
  { rawMaterial: { _id: "m1", name: "40s PC Black" }, price: 220, quantity: 500, received: 100 } as PoItem,
  { rawMaterial: { _id: "m2", name: "Spandex 840D" }, price: 900, quantity: 50, received: 0 } as PoItem,
];
const body = {
  success: true, aiSuggestion: "ai9",
  read: { problem: null, dcNo: "SY/DC/412", invoiceNo: "" },
  rows: [
    { description: "40s PC black", quantity: 150.5, unit: "kg", lotNo: "L2611", shade: "Black 1102", rawMaterial: "m1", materialName: "40s PC Black", pending: 400 },
    { description: "40s PC black", quantity: 99.5, unit: "kg", lotNo: "L2612", shade: "Black 1102", rawMaterial: "m1", materialName: "40s PC Black", pending: 400 },
    { description: "Spandex 840 D", quantity: 20, unit: "kg", lotNo: "SP77", shade: "", rawMaterial: "m2", materialName: "Spandex 840D", pending: 50 },
    { description: "30s PC black", quantity: 10, unit: "kg", lotNo: "", shade: "", rawMaterial: null, materialName: null, pending: null },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("goods received from the supplier's challan", () => {
  it("fills each line from what was read and lists what to check", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    const onSubmit = vi.fn();
    render(<InwardForm poId="po1" items={items} submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.upload(screen.getByLabelText("challan photo"), new File([new Uint8Array([1])], "dc.jpg", { type: "image/jpeg" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/supplier/inward/read?poId=po1", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByLabelText(/Quantity received for 40s PC Black/i)).toHaveValue(150.5);
    expect(screen.getByLabelText(/Quantity received for Spandex 840D/i)).toHaveValue(20);
    const notes = screen.getByRole("note");
    expect(notes).toHaveTextContent("40s PC Black lot L2612 — 99.5 kg: record it as another inward");
    expect(notes).toHaveTextContent("“30s PC black” 10 kg is not on this PO");
    await userEvent.click(screen.getByRole("button", { name: /record inward/i }));
    expect(onSubmit.mock.calls[0][0]).toEqual([
      expect.objectContaining({ rawMaterial: "m1", quantity: 150.5, lotNo: "L2611", shade: "Black 1102", remarks: "Their DC SY/DC/412" }),
      expect.objectContaining({ rawMaterial: "m2", quantity: 20, lotNo: "SP77" }),
    ]);
  });
});
