import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployeeForm } from "./EmployeeForm";
import type { AadhaarQrResult } from "./types";

// The new-employee form, filled from the card's QR code: the details go
// into the form, and the code goes with the record for the server to
// read again and keep the check.

const checkAadhaarQr = vi.fn();
vi.mock("./api", () => ({ employeeService: { checkAadhaarQr: (...a: unknown[]) => checkAadhaarQr(...a) } }));
vi.mock("@/features/floor/QrScanner", () => ({
  QrScanner: ({ onCode }: { onCode: (c: string) => void }) => <button type="button" onClick={() => onCode("4021987")}>Stand-in camera</button>,
}));
vi.mock("@/features/common/PhotoFill", () => ({ PhotoFillButton: () => null }));

const signed: AadhaarQrResult = {
  read: {
    kind: "secure", version: "V2", layout: "known", signature: "valid", key: "k.cer", last4: "9012", issuedAt: null,
    aadhaar: null, mobileLast4: "3210",
    fields: { name: "Murugan R", dob: "1990-03-12", gender: "male", careOf: "", address: "12, Mill Street, Erode", pincode: "638001" },
  },
  matches: { last4: null, name: null, phone: null },
  check: null,
};

describe("the new-employee form and the Aadhaar QR code", () => {
  it("fills from the card and sends the code with the record", async () => {
    checkAadhaarQr.mockResolvedValue(signed);
    const onSubmit = vi.fn();
    render(<EmployeeForm submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Scan the Aadhaar QR code/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /agrees to this check/ }));
    await userEvent.click(screen.getByRole("button", { name: "Stand-in camera" }));
    await userEvent.click(await screen.findByRole("button", { name: "Fill the form" }));

    expect(screen.getByLabelText("Full name *")).toHaveValue("Murugan R");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("1990-03-12");
    expect(screen.getByLabelText("Pin code")).toHaveValue("638001");
    expect(screen.getByRole("note")).toHaveTextContent("Signed by UIDAI");

    await userEvent.click(screen.getByRole("button", { name: "Add employee" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "Murugan R", dob: "1990-03-12", gender: "male", address: "12, Mill Street, Erode", pincode: "638001",
      aadhaarQr: "4021987", aadhaarQrConsent: true,
    }));
  });

  it("keeps a typed name, and notes the card's when it differs", async () => {
    checkAadhaarQr.mockResolvedValue({ ...signed, matches: { last4: null, name: "different", phone: null } });
    render(<EmployeeForm submitting={false} onSubmit={() => {}} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Full name *"), "Selvi K");
    await userEvent.click(screen.getByRole("button", { name: /Scan the Aadhaar QR code/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /agrees to this check/ }));
    await userEvent.click(screen.getByRole("button", { name: "Stand-in camera" }));
    await userEvent.click(await screen.findByRole("button", { name: "Fill the form" }));
    expect(screen.getByLabelText("Full name *")).toHaveValue("Selvi K");
    expect(screen.getByRole("note")).toHaveTextContent('The card says "Murugan R"');
  });

  it("an edit sends the details as they stand, and never the code", async () => {
    const onSubmit = vi.fn();
    render(<EmployeeForm initial={{ name: "Murugan R", department: "weaving", dob: "1990-03-12", gender: "male", address: "Erode", pincode: "638001" }} employeeId="e1" submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.clear(screen.getByLabelText("Address"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const sent = onSubmit.mock.calls[0][0];
    expect(sent).toEqual(expect.objectContaining({ dob: "1990-03-12", gender: "male", address: "", pincode: "638001" }));
    expect(sent.aadhaarQr).toBeUndefined();
  });
});
