import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceSettingsForm } from "./InvoiceSettingsForm";

// ══════════════════════════════════════════════════════════════════
//  E-INVOICE THROUGH CLEARTAX, FROM SETTINGS → INVOICE
//
//  The IRP API user is kept in ClearTax, so ClearTax asks for less than
//  a generic GSP: which ClearTax (live or sandbox) and the workspace's
//  auth token. The token is sent only to ClearTax, so choosing ClearTax
//  moves the address off one left from another GSP.
// ══════════════════════════════════════════════════════════════════

const mutate = vi.fn();
const toast = vi.fn();
let stored: Record<string, unknown>;

vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./hooks", () => ({
  // The same object every render, as react-query hands it back.
  useDocumentSettings: () => ({ data: stored, isLoading: false, isError: false, error: null }),
  useUpdateDocumentSettings: () => ({ mutate, isPending: false }),
}));

const settingsWith = (gsp: Record<string, unknown>) => ({
  companyName: "Balu Elastics",
  invoice: {
    defaultHsn: "5806", defaultGstPercent: 5, city: "Erode", pincode: "638052", stateCode: "33",
    bank: { name: "", account: "", ifsc: "", branch: "", upiId: "" }, declaration: "",
    gsp: { provider: "", baseUrl: "", username: "", clientId: "", configured: false, ...gsp },
  },
});

const sentGsp = () => mutate.mock.calls[mutate.mock.calls.length - 1][0].invoice.gsp;

beforeEach(() => {
  mutate.mockReset();
  toast.mockReset();
  stored = settingsWith({});
});

describe("ClearTax in the invoice settings", () => {
  it("asks only for live or sandbox and the auth token, and saves them", async () => {
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    await user.selectOptions(screen.getByLabelText("Provider"), "cleartax");

    expect(screen.getByLabelText("ClearTax environment")).toHaveValue("https://api.clear.in");
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Portal username")).not.toBeInTheDocument();
    expect(screen.getByText(/add your GSTIN to e-invoicing with the IRP API user/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ClearTax environment"), "https://api-sandbox.clear.in");
    await user.type(screen.getByLabelText("ClearTax auth token"), "ws-token-1");
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));
    expect(sentGsp()).toMatchObject({ provider: "cleartax", baseUrl: "https://api-sandbox.clear.in", clientSecret: "ws-token-1" });
  });

  it("moves the address off one left from another GSP", async () => {
    stored = settingsWith({ provider: "http-json", baseUrl: "https://gsp.example/api", clientId: "id-1", configured: true });
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    expect(screen.getByLabelText("API base URL")).toHaveValue("https://gsp.example/api");

    await user.selectOptions(screen.getByLabelText("Provider"), "cleartax");
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));
    expect(sentGsp()).toMatchObject({ provider: "cleartax", baseUrl: "https://api.clear.in", clientSecret: "" });
  });

  it("keeps a stored token when the field is left blank", async () => {
    stored = settingsWith({ provider: "cleartax", baseUrl: "https://api.clear.in", configured: true });
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    expect(screen.getByLabelText("ClearTax auth token")).toHaveAttribute("placeholder", "stored — leave blank to keep");
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));
    // Blank means keep: the server leaves the stored token as it is.
    expect(sentGsp()).toMatchObject({ provider: "cleartax", baseUrl: "https://api.clear.in", clientSecret: "" });
  });

  it("a generic GSP still asks for its URL and credentials", async () => {
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    await user.selectOptions(screen.getByLabelText("Provider"), "http-json");
    expect(screen.getByLabelText("API base URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Client ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Portal password")).toBeInTheDocument();
    expect(screen.queryByLabelText("ClearTax environment")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════
//  THE GSTIN CHECK, FROM SETTINGS → INVOICE
//
//  "Verify" on the customer and supplier forms asks the GST system
//  through ClearTax when it is connected, or through a GSTIN lookup
//  service named here: its address with {gstin} in it, and its key.
// ══════════════════════════════════════════════════════════════════

const withLookup = (invoice: Record<string, unknown>) => {
  const base = settingsWith({});
  return { ...base, invoice: { ...base.invoice, ...invoice } };
};
const sentInvoice = () => mutate.mock.calls[mutate.mock.calls.length - 1][0].invoice;

describe("the GSTIN check in the invoice settings", () => {
  it("says who Verify will ask as things stand", () => {
    stored = withLookup({ gstinCheck: { available: true, via: "ClearTax" } });
    const { unmount } = render(<InvoiceSettingsForm />);
    expect(screen.getByText("through ClearTax")).toBeInTheDocument();
    unmount();

    stored = withLookup({ gstinCheck: { available: false, via: "" } });
    render(<InvoiceSettingsForm />);
    expect(screen.getByRole("heading", { name: "GSTIN check on customer and supplier forms" })).toBeInTheDocument();
    // Two cards can say it: the e-invoice provider and this one.
    expect(screen.getAllByText("not connected")).toHaveLength(2);
  });

  it("saves a lookup service's address, header and key, and not what the server says about it", async () => {
    stored = withLookup({ gstinLookup: { url: "", headerName: "", keySet: false }, gstinCheck: { available: false, via: "" } });
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    // Braces are keyboard keys to user-event: doubled to type one.
    await user.type(screen.getByLabelText("GSTIN lookup address"), " https://lookup.example.com/gst/{{gstin} ");
    await user.type(screen.getByLabelText("Header that carries the key"), "x-api-key");
    await user.type(screen.getByLabelText("GSTIN lookup key"), "lk-secret-9");
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));

    expect(sentInvoice().gstinLookup).toEqual({ url: "https://lookup.example.com/gst/{gstin}", headerName: "x-api-key", key: "lk-secret-9" });
    expect(sentInvoice()).not.toHaveProperty("gstinCheck");
  });

  it("keeps a stored key when the field is left blank", async () => {
    stored = withLookup({ gstinLookup: { url: "https://lookup.example.com/gst/{gstin}", headerName: "x-api-key", keySet: true }, gstinCheck: { available: true, via: "your GSTIN lookup service" } });
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    expect(screen.getByText("through your GSTIN lookup service")).toBeInTheDocument();
    expect(screen.getByLabelText("GSTIN lookup address")).toHaveValue("https://lookup.example.com/gst/{gstin}");
    expect(screen.getByLabelText("GSTIN lookup key")).toHaveValue("");
    expect(screen.getByLabelText("GSTIN lookup key")).toHaveAttribute("placeholder", "stored — leave blank to keep");
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));
    // Blank means keep: the server leaves the stored key as it is.
    expect(sentInvoice().gstinLookup).toEqual({ url: "https://lookup.example.com/gst/{gstin}", headerName: "x-api-key", key: "" });
  });

  it("does not save an address with nowhere for the number to go", async () => {
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    await user.type(screen.getByLabelText("GSTIN lookup address"), "https://lookup.example.com/gst");
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));
    expect(mutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("GSTIN lookup address: put {gstin} where the number goes", "error");
  });

  it("leaves the lookup blank when none is named", async () => {
    const user = userEvent.setup();
    render(<InvoiceSettingsForm />);
    await user.click(screen.getByRole("button", { name: /Save invoice settings/ }));
    expect(sentInvoice().gstinLookup).toEqual({ url: "", headerName: "", key: "" });
  });
});
