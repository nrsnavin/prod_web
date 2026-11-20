import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EwaybillDialog } from "./EwaybillDialog";

// The e-way bill's Part B. A number pasted from the portal exists already:
// the vehicle may be blank, as the hint under it says ("Leave blank when
// the transporter adds Part B") — but the button stayed off until a vehicle
// or a transporter was typed, and the server refused the blank one too.

const open = (mode: "generate" | "paste", onConfirm = vi.fn()) => {
  render(<EwaybillDialog docNo="INV/2026-27/0007" mode={mode} onClose={() => {}} onConfirm={onConfirm} />);
  return onConfirm;
};

describe("the e-way bill dialog", () => {
  it("records a pasted number with the vehicle left blank", async () => {
    const onConfirm = open("paste");
    const save = screen.getByRole("button", { name: "Record e-way bill" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("E-way bill number *"), "3210 9876 5432");
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ number: "321098765432", vehicleNo: undefined, transporterId: undefined }));
  });

  it("still wants all twelve digits of a pasted number", async () => {
    open("paste");
    await userEvent.type(screen.getByLabelText("E-way bill number *"), "32109876543");
    expect(screen.getByRole("button", { name: "Record e-way bill" })).toBeDisabled();
    expect(screen.getByText("11 of 12 digits")).toBeInTheDocument();
  });

  it("asks for the vehicle, or the transporter who will add it, before generating one", async () => {
    const onConfirm = open("generate");
    const go = screen.getByRole("button", { name: "Generate e-way bill" });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Transporter GSTIN / ID"), "33aabct1234f1z5");
    expect(go).toBeEnabled();
    await userEvent.click(go);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ transporterId: "33AABCT1234F1Z5", vehicleNo: undefined }));
  });
});
