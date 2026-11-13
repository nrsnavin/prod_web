import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyDetailsDialog } from "./CompanyDetailsDialog";
import type { Invoice } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE COMPANY'S DETAILS AND LOGO, FROM THE INVOICE
//
//  The same details as Settings → Documents & Branding, edited from the
//  invoice. Saving keeps them for every invoice and challan after; an
//  invoice not yet registered with the e-invoice portal can take them
//  too. A registered one keeps what it was issued with.
// ══════════════════════════════════════════════════════════════════

const updateMutate = vi.fn();
const adoptMutate = vi.fn();
const toast = vi.fn();
let role = "admin";

vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/settings/hooks", () => ({
  useDocumentSettings: () => ({
    isLoading: false,
    data: {
      companyName: "Balu Elastics", addressLines: ["12 Mill Road", "Perundurai"], gstin: "", phone: "9876543210", email: "",
      logo: "", tagline: "", website: "", footerNote: "", termsText: "", accentColor: "#1D6FEB",
      invoice: { city: "", pincode: "" },
    },
  }),
  useUpdateDocumentSettings: () => ({ mutateAsync: updateMutate, isPending: false }),
}));
vi.mock("./hooks", () => ({ useInvoiceMutations: () => ({ adoptCompanyDetails: { mutateAsync: adoptMutate, isPending: false } }) }));

const invoice = (over: Partial<Invoice> = {}) => ({
  _id: "i1", invoiceNumber: "INV/2026-27/0001", status: "issued", einvoice: { status: "pending" }, ...over,
}) as unknown as Invoice;

beforeEach(() => {
  role = "admin";
  updateMutate.mockReset().mockResolvedValue({});
  adoptMutate.mockReset().mockResolvedValue({ unchanged: false });
  toast.mockReset();
});

describe("company details from the invoice", () => {
  it("saves the details and puts them on an unregistered invoice", async () => {
    const user = userEvent.setup();
    render(<CompanyDetailsDialog invoice={invoice()} open onClose={() => {}} />);
    expect(screen.getByLabelText("Company name")).toHaveValue("Balu Elastics");
    await user.type(screen.getByLabelText("GSTIN"), "33aaecb1234f1z5");
    expect(screen.getByText("State code 33")).toBeInTheDocument();
    await user.type(screen.getByLabelText("City"), "Erode");
    await user.type(screen.getByLabelText("PIN code"), "638052");
    expect(screen.getByLabelText(/Use them on INV\/2026-27\/0001 too/)).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({
      companyName: "Balu Elastics", gstin: "33AAECB1234F1Z5", addressLines: ["12 Mill Road", "Perundurai"],
      invoice: { city: "Erode", pincode: "638052" },
    }));
    expect(adoptMutate).toHaveBeenCalledWith("i1");
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/this invoice now carries them/), "success");
  });

  it("refuses a malformed GSTIN before saving", async () => {
    const user = userEvent.setup();
    render(<CompanyDetailsDialog invoice={invoice()} open onClose={() => {}} />);
    await user.type(screen.getByLabelText("GSTIN"), "33ABC");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("leaves a registered invoice as it was issued", async () => {
    const user = userEvent.setup();
    render(<CompanyDetailsDialog invoice={invoice({ einvoice: { status: "registered" } as Invoice["einvoice"] })} open onClose={() => {}} />);
    expect(screen.queryByLabelText(/Use them on/)).not.toBeInTheDocument();
    expect(screen.getByText(/registered with the e-invoice portal/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateMutate).toHaveBeenCalled();
    expect(adoptMutate).not.toHaveBeenCalled();
  });

  it("lets someone who is not an admin only put the current details on the invoice", async () => {
    role = "accounts";
    const user = userEvent.setup();
    render(<CompanyDetailsDialog invoice={invoice()} open onClose={() => {}} />);
    expect(screen.getByLabelText("Company name")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Put them on this invoice" }));
    expect(updateMutate).not.toHaveBeenCalled();
    expect(adoptMutate).toHaveBeenCalledWith("i1");
  });
});
