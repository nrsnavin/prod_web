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
let stored: Record<string, unknown>;

vi.mock("@/core/auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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
