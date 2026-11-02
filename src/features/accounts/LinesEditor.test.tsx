import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { LinesEditor, blankLine, priceInputs } from "./shared";
import type { LineInput } from "./types";

// The lines on a bill, note or expense, totalled the way the server
// will total them: CGST+SGST in-state, IGST outside.

vi.mock("@/features/customers/api", () => ({ customerService: {} }));
vi.mock("@/features/suppliers/api", () => ({ supplierService: {} }));

function Harness({ supplyType }: { supplyType: "intra" | "inter" }) {
  const [lines, setLines] = useState<LineInput[]>([{ description: "Nylon 70D", hsn: "5402", unit: "kg", quantity: 60, rate: 310, gstPercent: 5 }]);
  return <LinesEditor lines={lines} onChange={setLines} supplyType={supplyType} />;
}

describe("priceInputs", () => {
  it("splits in-state and totals to the rupee", () => {
    const p = priceInputs([{ description: "x", quantity: 60, rate: 310, gstPercent: 5 }, { description: "y", quantity: 1, rate: 0.33, gstPercent: 5 }], "intra");
    expect(p.totals).toMatchObject({ taxable: 18600.33, cgst: 465.01, sgst: 465.01, igst: 0, grand: 19530 });
  });
  it("blank figures count as zero", () => {
    expect(priceInputs([blankLine(5)], "inter").totals.grand).toBe(0);
  });
});

describe("the lines editor", () => {
  it("shows the split for the supply type and adds a line that inherits the GST rate", async () => {
    render(<Harness supplyType="inter" />);
    expect(screen.getAllByText("IGST")).toHaveLength(2); // the column and the totals line
    expect(screen.getByLabelText("Totals")).toHaveTextContent("IGST930.00");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("Total₹19,530.00");
    await userEvent.click(screen.getByRole("button", { name: /add line/i }));
    expect(screen.getByLabelText("Line 2 GST %")).toHaveValue(5);
    expect(screen.getByLabelText("Remove line 1")).toBeEnabled();
  });

  it("re-totals as a rate is typed", async () => {
    render(<Harness supplyType="intra" />);
    const rate = screen.getByLabelText("Line 1 rate");
    await userEvent.clear(rate);
    await userEvent.type(rate, "100");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("CGST150.00");
    expect(screen.getByLabelText("Totals")).toHaveTextContent("Total₹6,300.00");
  });
});
