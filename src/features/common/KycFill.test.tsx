import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupplierForm } from "@/features/suppliers/SupplierListPage";
import { EmployeeForm } from "@/features/employees/EmployeeForm";

// A cancelled cheque fills a supplier's bank details (and says when the
// holder is not them); an Aadhaar / PAN card fills a new employee.

vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: vi.fn(async () => ({ similar: [] })), post: vi.fn() }, ApiError: class extends Error {} }));
afterEach(() => vi.unstubAllGlobals());
const reply = (body: unknown) => { const f = vi.fn(async () => ({ ok: true, json: async () => body })); vi.stubGlobal("fetch", f); return f; };
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
const photo = () => new File([new Uint8Array([1])], "x.jpg", { type: "image/jpeg" });

describe("a supplier's cancelled cheque", () => {
  it("fills the bank details and sends them as read from a cheque", async () => {
    const f = reply({ success: true, read: { problem: null, accountNo: "9988776655", ifsc: "ICIC0000999", holder: "SRI YARN TRADERS" }, holderMatches: true, aiSuggestion: "a1" });
    const onSubmit = vi.fn();
    wrap(<SupplierForm defaultName="Sri Yarn Traders" submitting={false} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.upload(screen.getByLabelText("cheque photo"), photo());
    expect(f).toHaveBeenCalledWith("/api/v2/supplier/read-cheque?name=Sri%20Yarn%20Traders", expect.anything());
    expect(await screen.findByLabelText("Account number")).toHaveValue("9988776655");
    expect(screen.getByLabelText("IFSC")).toHaveValue("ICIC0000999");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save|create|add supplier/i }));
    expect(onSubmit.mock.calls[0][0].bank).toMatchObject({ accountNo: "9988776655", source: "cheque", holderMatches: true });
  });

  it("warns when the holder on the cheque is not the supplier", async () => {
    reply({ success: true, read: { problem: null, accountNo: "1122334455", ifsc: "SBIN0000001", holder: "AMAZON PAY INDIA" }, holderMatches: false, aiSuggestion: "a2" });
    wrap(<SupplierForm defaultName="Sri Yarn Traders" submitting={false} onSubmit={() => {}} onCancel={() => {}} />);
    await userEvent.upload(screen.getByLabelText("cheque photo"), photo());
    expect(await screen.findByRole("alert")).toHaveTextContent("The holder on the cheque, “AMAZON PAY INDIA”, is not this supplier's name");
  });
});

describe("an employee's ID card", () => {
  it("fills the name and Aadhaar, and says when the number fails its check", async () => {
    reply({ success: true, read: { problem: null, name: "R. Murugan", dob: "1990-03-12", gender: "male", pan: "ABCDE1234F", aadhaar: "499118665247", aadhaarValid: false }, aiSuggestion: "a3" });
    wrap(<EmployeeForm submitting={false} onSubmit={() => {}} onCancel={() => {}} />);
    await userEvent.upload(screen.getByLabelText("ID card photo"), photo());
    expect(await screen.findByLabelText("Full name *")).toHaveValue("R. Murugan");
    expect(screen.getByLabelText("Aadhaar")).toHaveValue("499118665247");
    expect(screen.getByRole("note")).toHaveTextContent("does not pass its check digit — compare it with the card. Born 12/03/1990 · male · PAN ABCDE1234F");
  });

  it("is not offered to someone who may not set an Aadhaar", () => {
    wrap(<EmployeeForm submitting={false} onSubmit={() => {}} onCancel={() => {}} canEditAadhaar={false} />);
    expect(screen.queryByRole("button", { name: /Aadhaar \/ PAN/ })).not.toBeInTheDocument();
  });
});
