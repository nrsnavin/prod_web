import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/core/http/httpClient";
import { AadhaarQrDialog, signatureWords } from "./AadhaarQrDialog";
import type { AadhaarQrResult } from "./types";

// The card's QR code: the holder agrees first, the camera (here a stand-in)
// reads it, and the server's answer is shown for what it is.

const checkAadhaarQr = vi.fn();
vi.mock("./api", () => ({ employeeService: { checkAadhaarQr: (...a: unknown[]) => checkAadhaarQr(...a) } }));
vi.mock("@/features/floor/QrScanner", () => ({
  QrScanner: ({ onCode }: { onCode: (c: string) => void }) => <button type="button" onClick={() => onCode("4021987")}>Stand-in camera</button>,
}));
const qrFromPhoto = vi.fn();
vi.mock("@/features/floor/photoQr", () => ({ qrFromPhoto: (...a: unknown[]) => qrFromPhoto(...a) }));

const result = (over: Partial<AadhaarQrResult["read"]> = {}, check: AadhaarQrResult["check"] = null): AadhaarQrResult => ({
  read: {
    kind: "secure", version: "V2", layout: "known", signature: "valid", key: "uidai_offline_publickey_2026.cer",
    last4: "9012", issuedAt: "2025-01-15T05:00:45.123Z", aadhaar: null, mobileLast4: "3210",
    fields: { name: "Murugan R", dob: "1990-03-12", gender: "male", careOf: "S/O: Ramasamy", address: "12, Mill Street, Erode", pincode: "638001" },
    ...over,
  },
  matches: { last4: true, name: "same", phone: true },
  check,
});

const agreeAndScan = async () => {
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Stand-in camera" }));
};

beforeEach(() => { checkAadhaarQr.mockReset(); qrFromPhoto.mockReset(); });

describe("the Aadhaar QR check", () => {
  it("starts the camera only once the employee has agreed", async () => {
    render(<AadhaarQrDialog open onClose={() => {}} personName="Murugan R" />);
    expect(screen.getByText(/Murugan R agrees to this check/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stand-in camera" })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Stand-in camera" })).toBeInTheDocument();
  });

  it("on the form: compares with what was typed, shows the card, and fills the form", async () => {
    checkAadhaarQr.mockResolvedValue(result());
    const onFill = vi.fn();
    render(<AadhaarQrDialog open onClose={() => {}} compare={{ name: "Murugan R", phoneNumber: "9876543210", aadhar: "234567899012" }} onFill={onFill} />);
    await agreeAndScan();
    expect(checkAadhaarQr).toHaveBeenCalledWith({ qr: "4021987", consent: true, compare: { name: "Murugan R", phoneNumber: "9876543210", aadhar: "234567899012" } });
    expect(await screen.findByText("Signed by UIDAI")).toBeInTheDocument();
    expect(screen.getByText("12/03/1990")).toBeInTheDocument();
    expect(screen.getByText("ends in 9012")).toBeInTheDocument();
    expect(screen.getByText(/Name matches/)).toBeInTheDocument();
    expect(screen.getByText(/Phone matches the mobile registered with Aadhaar/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fill the form" }));
    expect(onFill).toHaveBeenCalledWith(expect.objectContaining({ read: expect.objectContaining({ last4: "9012" }) }), "4021987");
  });

  it("on an employee: keeps the outcome on their record and says so", async () => {
    checkAadhaarQr.mockResolvedValue(result({}, { method: "qr", kind: "secure", layout: "known", signature: "valid", matches: { last4: true, name: "same", phone: true }, consent: true, at: "2026-11-12T00:00:00.000Z" }));
    const onChecked = vi.fn();
    render(<AadhaarQrDialog open onClose={() => {}} employeeId="emp1" onChecked={onChecked} />);
    await agreeAndScan();
    expect(checkAadhaarQr).toHaveBeenCalledWith({ qr: "4021987", consent: true, employeeId: "emp1" });
    expect(await screen.findByText("Kept on their record.")).toBeInTheDocument();
    expect(onChecked).toHaveBeenCalled();
  });

  it("never presents a changed code as genuine, nor offers its details", async () => {
    checkAadhaarQr.mockResolvedValue({ ...result({ signature: "invalid", key: null }), matches: { last4: false, name: "different", phone: null } });
    const onFill = vi.fn();
    render(<AadhaarQrDialog open onClose={() => {}} onFill={onFill} />);
    await agreeAndScan();
    expect(await screen.findByText("UIDAI's signature does not match")).toBeInTheDocument();
    // Its details are altered: no tick or cross is drawn from them.
    expect(screen.queryByText(/Name does not match/)).toBeNull();
    expect(screen.queryByText(/Last 4 digits/)).toBeNull();
    expect(screen.getByText(/No comparison is shown/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fill the form" })).toBeNull();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("says when the layout could not be read field by field", async () => {
    checkAadhaarQr.mockResolvedValue(result({ version: "V5", layout: "unreadable", fields: null }));
    render(<AadhaarQrDialog open onClose={() => {}} onFill={() => {}} />);
    await agreeAndScan();
    expect(await screen.findByText(/QR layout \(V5\) is not one this version can read/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fill the form" })).toBeNull();
  });

  it("shows the server's words when a code is refused", async () => {
    checkAadhaarQr.mockRejectedValue(new ApiError("This is not an Aadhaar QR code. Scan the large QR code on the Aadhaar letter, the e-Aadhaar or the PVC card.", 400));
    render(<AadhaarQrDialog open onClose={() => {}} />);
    await agreeAndScan();
    expect(await screen.findByRole("alert")).toHaveTextContent("This is not an Aadhaar QR code");
  });

  it("reads a chosen photo, and says when there is no code in it", async () => {
    qrFromPhoto.mockResolvedValueOnce(null);
    render(<AadhaarQrDialog open onClose={() => {}} />);
    await userEvent.click(screen.getByRole("checkbox"));
    const file = new File(["x"], "card.jpg", { type: "image/jpeg" });
    await userEvent.upload(screen.getByLabelText("Photo of the Aadhaar QR code"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent("No QR code was found in that photo");
    qrFromPhoto.mockResolvedValueOnce("4021987");
    checkAadhaarQr.mockResolvedValue(result());
    await userEvent.upload(screen.getByLabelText("Photo of the Aadhaar QR code"), file);
    expect(await screen.findByText("Signed by UIDAI")).toBeInTheDocument();
    expect(qrFromPhoto).toHaveBeenLastCalledWith(file, [2400, 1600, 1000]);
  });
});

describe("the signature, in words", () => {
  it("has a tone and a reason for every state", () => {
    expect(signatureWords("valid").tone).toBe("success");
    expect(signatureWords("invalid").tone).toBe("danger");
    expect(signatureWords("unchecked").detail).toMatch(/node scripts\/fetch-uidai-certs\.js/);
    expect(signatureWords("unsigned").title).toMatch(/Old QR code/);
  });
});
