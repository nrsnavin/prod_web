import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CustomerForm } from "@/features/customers/CustomerForm";
import { SupplierForm } from "@/features/suppliers/SupplierListPage";
import type { Customer } from "@/features/customers/types";
import type { Supplier } from "@/features/suppliers/types";
import type { GstinAnswer, GstinPortal } from "./GstinVerify";

// ══════════════════════════════════════════════════════════════════
//  "VERIFY" BESIDE THE GSTIN — the customer and supplier forms
//
//  One click asks the GST system (through the server) who the number is
//  registered to and whether it is still active, and fills the form.
//
//    • empty fields are filled from the registration
//    • what somebody typed is kept, with one click to take the
//      registration's value instead
//    • a cancelled registration fills nothing by itself and says so
//    • "no registration came back", a typo and a failed check are each
//      said as what they are, and fill nothing
//    • an existing party shows its last check and is not changed by it
//    • the result is about one number: change the GSTIN and it goes
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
const post = vi.fn();
vi.mock("@/core/http/httpClient", () => ({
  httpClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  ApiError: class extends Error {},
}));
vi.mock("@/core/hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(v: T) => v }));
vi.mock("@/core/http/upload", () => ({ uploadForm: vi.fn() }));

const GSTIN = "33AAECB1234F1ZC";

const portal = (over: Partial<GstinPortal> = {}): GstinPortal => ({
  checked: true, found: true, fromCache: false, checkedAt: "2026-11-18T10:12:00.000Z", checkedByName: "Owner", via: "ClearTax", said: "",
  status: "active", statusText: "Active", legalName: "SUNRISE GARMENTS PRIVATE LIMITED", tradeName: "Sunrise Garments",
  taxpayerType: "Regular", registeredOn: "2017-07-01", cancelledOn: "", einvoiceBlocked: false, ...over,
});

const answer = (over: Partial<GstinAnswer> = {}): GstinAnswer => ({
  gstin: GSTIN, valid: true, checksumOk: true, stateCode: "33", stateName: "Tamil Nadu", pan: "AAECB1234F",
  portal: portal(),
  fill: {
    name: "Sunrise Garments", legalName: "SUNRISE GARMENTS PRIVATE LIMITED", tradeName: "Sunrise Garments",
    address: "12/4, 2nd Floor, Sunrise Towers, Avinashi Road", city: "Tiruppur", pincode: "641603", stateCode: "33",
    fullAddress: "12/4, 2nd Floor, Sunrise Towers, Avinashi Road, Tiruppur, Tamil Nadu - 641603",
    pan: "AAECB1234F", gstRegistration: "regular", sez: false,
  },
  message: "Active on the GST portal: SUNRISE GARMENTS PRIVATE LIMITED (trade name Sunrise Garments).",
  ...over,
});

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);
const customerForm = (props: { initial?: Customer; onSubmit?: (v: unknown) => void } = {}) =>
  wrap(<CustomerForm submitting={false} onSubmit={props.onSubmit ?? (() => {})} onCancel={() => {}} initial={props.initial} />);
const supplierForm = (props: { initial?: Supplier; onSubmit?: (v: unknown) => void } = {}) =>
  wrap(<SupplierForm submitting={false} onSubmit={props.onSubmit ?? (() => {})} onCancel={() => {}} initial={props.initial} />);

const verifyButton = () => screen.getByRole("button", { name: "Verify" });
const result = () => screen.findByRole("status", { name: "GSTIN check" });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  // The form's own reads: groups in use, who on file looks the same.
  get.mockImplementation(async (url: string) => (url.endsWith("/check") ? { success: true, check: null, lookup: { available: true, via: "ClearTax" } } : { groups: [], similar: [] }));
});

describe("Verify on the customer form", () => {
  it("is a small button beside the GSTIN, there once a whole GSTIN is typed", async () => {
    const user = userEvent.setup();
    customerForm();
    expect(verifyButton()).toBeDisabled();
    await user.type(screen.getByLabelText("GSTIN"), "33AAECB1234F");
    expect(verifyButton()).toBeDisabled();
    await user.type(screen.getByLabelText("GSTIN"), "1ZC");
    expect(verifyButton()).toBeEnabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("asks the server, says what the portal holds, and fills the empty fields", async () => {
    post.mockResolvedValue(answer());
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    customerForm({ onSubmit });
    await user.type(screen.getByLabelText("GSTIN"), "33aaecb1234f1zc");
    await user.click(verifyButton());

    expect(post).toHaveBeenCalledWith(`/customer/gstin/${GSTIN}/verify`, {}, expect.objectContaining({ timeoutMs: expect.any(Number) }));
    const box = await result();
    expect(within(box).getByText("Active on the GST portal")).toBeInTheDocument();
    expect(within(box).getByText("SUNRISE GARMENTS PRIVATE LIMITED · trade name Sunrise Garments")).toBeInTheDocument();
    expect(box).toHaveTextContent("Regular · registered 1 Jul 2017");
    expect(box).toHaveTextContent("12/4, 2nd Floor, Sunrise Towers, Avinashi Road, Tiruppur, Tamil Nadu - 641603");
    // The state code was already there, read off the number as it was typed.
    expect(box).toHaveTextContent("Filled in: Company name, Billing address, City, PIN code, PAN.");
    expect(box).toHaveTextContent(/Checked 18 Nov 2026, \d{1,2}:\d{2} [ap]m through ClearTax by Owner\./);

    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise Garments");
    expect(screen.getByLabelText("Billing address")).toHaveValue("12/4, 2nd Floor, Sunrise Towers, Avinashi Road");
    expect(screen.getByLabelText("City")).toHaveValue("Tiruppur");
    expect(screen.getByLabelText("PIN code")).toHaveValue("641603");
    expect(screen.getByLabelText("GST state code")).toHaveValue("33");
    expect(screen.getByLabelText("PAN")).toHaveValue("AAECB1234F");

    await user.click(screen.getByRole("button", { name: "Add customer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Sunrise Garments", address: "12/4, 2nd Floor, Sunrise Towers, Avinashi Road", city: "Tiruppur", pincode: "641603", stateCode: "33", pan: "AAECB1234F",
    });
  });

  it("keeps what was typed, and takes the registration's value on one click", async () => {
    post.mockResolvedValue(answer());
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("Company name *"), "Sunrise");
    await user.type(screen.getByLabelText("City"), "Tirupur");
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());

    const box = await result();
    expect(box).toHaveTextContent("Filled in: Billing address, PIN code, PAN.");
    expect(box).toHaveTextContent("Company name is kept as typed (“Sunrise”). The registration has “Sunrise Garments”.");
    expect(box).toHaveTextContent("City is kept as typed (“Tirupur”). The registration has “Tiruppur”.");
    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise");
    expect(screen.getByLabelText("City")).toHaveValue("Tirupur");

    const [nameUse, cityUse] = within(box).getAllByRole("button", { name: "Use the registration's" });
    await user.click(cityUse);
    expect(screen.getByLabelText("City")).toHaveValue("Tiruppur");
    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise"); // still theirs
    expect(box).toHaveTextContent("Filled in: Billing address, PIN code, PAN, City.");
    expect(box).not.toHaveTextContent("City is kept as typed");

    await user.click(nameUse);
    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise Garments");
    expect(within(box).queryByRole("button", { name: "Use the registration's" })).not.toBeInTheDocument();
  });

  it("offers the legal name when the form holds the trade name, and the other way round", async () => {
    post.mockResolvedValue(answer());
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    const box = await result();
    expect(box).toHaveTextContent("Its legal name is “SUNRISE GARMENTS PRIVATE LIMITED”.");
    await user.click(within(box).getByRole("button", { name: "Use the legal name" }));
    expect(screen.getByLabelText("Company name *")).toHaveValue("SUNRISE GARMENTS PRIVATE LIMITED");
    expect(box).toHaveTextContent("Its trade name is “Sunrise Garments”.");
    expect(within(box).getByRole("button", { name: "Use the trade name" })).toBeInTheDocument();
  });

  it("says when the form already matches", async () => {
    post.mockResolvedValue(answer());
    const user = userEvent.setup();
    customerForm({
      initial: { _id: "c1", name: "Sunrise Garments", gstin: GSTIN, address: "12/4, 2nd floor, Sunrise Towers, Avinashi Road", city: "TIRUPPUR", pincode: "641603", stateCode: "33", pan: "AAECB1234F" },
    });
    await user.click(verifyButton());
    expect(await result()).toHaveTextContent("The form already matches the registration.");
  });

  it("ticks SEZ unit for a registration that is one", async () => {
    const a = answer();
    post.mockResolvedValue({ ...a, portal: portal({ taxpayerType: "SEZ unit" }), fill: { ...a.fill!, sez: true } });
    const user = userEvent.setup();
    customerForm();
    expect(screen.getByLabelText(/SEZ unit/)).not.toBeChecked();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    expect(await result()).toHaveTextContent("PAN, SEZ unit (ticked).");
    expect(screen.getByLabelText(/SEZ unit/)).toBeChecked();
  });

  it("a cancelled registration says so and fills nothing until asked", async () => {
    post.mockResolvedValue(answer({
      portal: portal({ status: "cancelled", statusText: "Cancelled", cancelledOn: "2024-03-12" }),
      message: "Cancelled on the GST portal since 12 Mar 2024: SUNRISE GARMENTS PRIVATE LIMITED (trade name Sunrise Garments). It is no longer a registered party.",
    }));
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());

    const box = await screen.findByRole("alert", { name: "GSTIN check" });
    expect(within(box).getByText("Cancelled on the GST portal")).toBeInTheDocument();
    expect(box).toHaveTextContent("It is no longer a registered party.");
    expect(box).toHaveTextContent("cancelled 12 Mar 2024");
    expect(box).toHaveTextContent("Nothing was filled in by itself.");
    expect(screen.getByLabelText("Company name *")).toHaveValue("");
    expect(screen.getByLabelText("Billing address")).toHaveValue("");

    await user.click(within(box).getByRole("button", { name: "Fill the form from this" }));
    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise Garments");
    expect(box).toHaveTextContent("Filled in: Company name, Billing address, City, PIN code, PAN.");
  });

  it("warns about a GSTIN the e-invoice system has blocked", async () => {
    post.mockResolvedValue(answer({ portal: portal({ einvoiceBlocked: true }) }));
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    expect(await result()).toHaveTextContent("The e-invoice system has this GSTIN blocked: an IRN cannot be raised on it.");
  });

  it("no registration came back: said in the provider's words, nothing filled", async () => {
    post.mockResolvedValue(answer({
      portal: { checked: true, found: false, fromCache: false, checkedAt: "2026-11-18T10:12:00.000Z", checkedByName: "Owner", via: "ClearTax", said: "3001: Requested data is not available", status: "unknown" },
      fill: null,
      message: `No registration came back for ${GSTIN} from the GST portal — it said: 3001: Requested data is not available.`,
    }));
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    const box = await screen.findByRole("alert");
    expect(box).toHaveTextContent(`No registration came back for ${GSTIN} from the GST portal — it said: 3001: Requested data is not available.`);
    expect(box).toHaveTextContent("Nothing was filled in.");
    expect(screen.getByLabelText("Company name *")).toHaveValue("");
    expect(screen.getByLabelText("PAN")).toHaveValue("");
  });

  it("a mistyped number is said as a typo, and was not sent to the portal", async () => {
    post.mockResolvedValue(answer({
      gstin: "33AAECB1234F1Z5", checksumOk: false, portal: { checked: false, reason: "checksum" }, fill: null,
      message: "The last character does not match the rest of the number — check for a typo. It was not sent to the GST portal.",
    }));
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), "33AAECB1234F1Z5");
    await user.click(verifyButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("check for a typo. It was not sent to the GST portal.");
    expect(screen.getByLabelText("PAN")).toHaveValue("");
  });

  it("with nobody connected it says how to connect, and still fills what the number itself gives", async () => {
    post.mockResolvedValue(answer({
      portal: { checked: false, reason: "not_connected" }, fill: null,
      message: "The number is well-formed (Tamil Nadu, PAN AAECB1234F). Checking it with the GST portal needs a connection: ClearTax or a GSTIN lookup service, in Settings → Invoice.",
    }));
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    const box = await screen.findByRole("status");
    expect(box).toHaveTextContent("needs a connection: ClearTax or a GSTIN lookup service, in Settings → Invoice.");
    expect(box).toHaveTextContent("Filled in from the number itself: PAN.");
    expect(screen.getByLabelText("PAN")).toHaveValue("AAECB1234F");
    expect(screen.getByLabelText("Company name *")).toHaveValue("");
  });

  it("a check that failed says why, and fills nothing", async () => {
    post.mockRejectedValue(new Error("ClearTax refused the GSTIN lookup (401): 1005: Invalid Token. Check the connection in Settings → Invoice."));
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("ClearTax refused the GSTIN lookup (401): 1005: Invalid Token.");
    expect(screen.getByLabelText("Company name *")).toHaveValue("");
    expect(verifyButton()).toBeEnabled(); // and can be tried again
  });

  it("the result goes when the GSTIN is changed, and Check again asks afresh", async () => {
    post.mockResolvedValue(answer());
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    const box = await result();

    await user.click(within(box).getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenLastCalledWith(`/customer/gstin/${GSTIN}/verify`, { fresh: true }, expect.anything());

    await user.type(screen.getByLabelText("GSTIN"), "{backspace}");
    expect(screen.queryByRole("status", { name: "GSTIN check" })).not.toBeInTheDocument();
  });
});

describe("a second number on the same form", () => {
  const OTHER = "29AAGCM9012L1Z3";
  const meridian = (): GstinAnswer => ({
    gstin: OTHER, valid: true, checksumOk: true, stateCode: "29", stateName: "Karnataka", pan: "AAGCM9012L",
    portal: portal({ legalName: "MERIDIAN KNITS LLP", tradeName: "Meridian Knits", registeredOn: "2018-04-12" }),
    fill: {
      name: "Meridian Knits", legalName: "MERIDIAN KNITS LLP", tradeName: "Meridian Knits", address: "88, Peenya 2nd Stage", city: "Bengaluru",
      pincode: "560058", stateCode: "29", fullAddress: "88, Peenya 2nd Stage, Bengaluru, Karnataka - 560058", pan: "AAGCM9012L", gstRegistration: "regular", sez: false,
    },
    message: "Active on the GST portal: MERIDIAN KNITS LLP (trade name Meridian Knits).",
  });
  const retype = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
    await user.clear(screen.getByLabelText("GSTIN"));
    await user.type(screen.getByLabelText("GSTIN"), value);
  };

  it("replaces what the first check filled in, and keeps what a person typed", async () => {
    post.mockResolvedValueOnce(answer()).mockResolvedValueOnce(meridian());
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("Contact person"), "Ravi");
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    await result();
    expect(screen.getByLabelText("City")).toHaveValue("Tiruppur");

    await retype(user, OTHER);
    // The state code follows the number: it was read off the first one, not typed.
    expect(screen.getByLabelText("GST state code")).toHaveValue("29");
    await user.click(verifyButton());
    const box = await result();
    await waitFor(() => expect(screen.getByLabelText("Company name *")).toHaveValue("Meridian Knits"));
    expect(screen.getByLabelText("Billing address")).toHaveValue("88, Peenya 2nd Stage");
    expect(screen.getByLabelText("City")).toHaveValue("Bengaluru");
    expect(screen.getByLabelText("PIN code")).toHaveValue("560058");
    expect(screen.getByLabelText("PAN")).toHaveValue("AAGCM9012L");
    expect(screen.getByLabelText("Contact person")).toHaveValue("Ravi");
    expect(box).toHaveTextContent("Filled in: Company name, Billing address, City, PIN code, PAN.");
    expect(within(box).queryByRole("button", { name: "Use the registration's" })).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("a field changed by hand after the first check is theirs, and is kept", async () => {
    post.mockResolvedValueOnce(answer()).mockResolvedValueOnce(meridian());
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    await result();
    await user.clear(screen.getByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Avinashi");

    await retype(user, OTHER);
    await user.click(verifyButton());
    const box = await result();
    await waitFor(() => expect(screen.getByLabelText("Company name *")).toHaveValue("Meridian Knits"));
    expect(screen.getByLabelText("City")).toHaveValue("Avinashi");
    expect(box).toHaveTextContent("City is kept as typed (“Avinashi”). The registration has “Bengaluru”.");
  });

  it("says whose details the form still holds when the second number fills nothing, and clears them on a click", async () => {
    post.mockResolvedValueOnce(answer()).mockResolvedValueOnce({
      ...meridian(), fill: null,
      portal: { checked: true, found: false, checkedAt: "2026-11-18T10:12:00.000Z", via: "ClearTax", said: "No records found", status: "unknown" },
      message: `No registration came back for ${OTHER} from the GST portal — it said: No records found.`,
    });
    const user = userEvent.setup();
    customerForm();
    await user.type(screen.getByLabelText("Phone"), "9000000001");
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());
    await result();

    // Not at every keystroke on the way to another number…
    await user.type(screen.getByLabelText("GSTIN"), "{backspace}");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    // …but as soon as a whole other GSTIN stands there, before it is even checked.
    await retype(user, OTHER);
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent(`The form still holds what was filled in from ${GSTIN}, a different GSTIN: Company name, Billing address, City, PIN code, PAN.`);

    await user.click(verifyButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("No registration came back");
    expect(screen.getByRole("note")).toHaveTextContent("Company name, Billing address, City, PIN code, PAN.");
    expect(screen.getByLabelText("Billing address")).toHaveValue("12/4, 2nd Floor, Sunrise Towers, Avinashi Road");

    await user.click(within(screen.getByRole("note")).getByRole("button", { name: "Clear them" }));
    expect(screen.getByLabelText("Company name *")).toHaveValue("");
    expect(screen.getByLabelText("Billing address")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByLabelText("PIN code")).toHaveValue("");
    expect(screen.getByLabelText("PAN")).toHaveValue("");
    expect(screen.getByLabelText("Phone")).toHaveValue("9000000001"); // theirs
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("a state code somebody typed is not moved by a new GSTIN", async () => {
    const user = userEvent.setup();
    customerForm({ initial: { _id: "c9", name: "Depot", gstin: GSTIN, stateCode: "32" } });
    await retype(user, OTHER);
    expect(screen.getByLabelText("GST state code")).toHaveValue("32");
  });

  it("an existing customer's state code follows a GSTIN moved to another state", async () => {
    const user = userEvent.setup();
    customerForm({ initial: { _id: "c8", name: "Sunrise", gstin: GSTIN, stateCode: "33" } });
    await retype(user, OTHER);
    expect(screen.getByLabelText("GST state code")).toHaveValue("29");
  });
});

describe("a customer opened again", () => {
  const initial: Customer = { _id: "c1", name: "Sunrise", gstin: GSTIN, address: "", city: "", pincode: "", stateCode: "33" };

  it("shows the last check of its GSTIN, and is not changed by it", async () => {
    get.mockImplementation(async (url: string) => (url.endsWith("/check")
      ? { success: true, check: answer({ portal: portal({ fromCache: true, checkedAt: "2026-11-02T06:30:00.000Z" }) }), lookup: { available: true, via: "ClearTax" } }
      : { groups: [], similar: [] }));
    const user = userEvent.setup();
    customerForm({ initial });

    const box = await result();
    expect(get).toHaveBeenCalledWith(`/customer/gstin/${GSTIN}/check`);
    expect(post).not.toHaveBeenCalled();
    expect(within(box).getByText("Active on the GST portal")).toBeInTheDocument();
    expect(box).toHaveTextContent(/Last check: 2 Nov 2026, \d{1,2}:\d{2} [ap]m through ClearTax by Owner\./);
    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise");
    expect(screen.getByLabelText("Billing address")).toHaveValue("");

    await user.click(within(box).getByRole("button", { name: "Fill the form from this" }));
    expect(screen.getByLabelText("Billing address")).toHaveValue("12/4, 2nd Floor, Sunrise Towers, Avinashi Road");
    expect(screen.getByLabelText("Company name *")).toHaveValue("Sunrise"); // typed stays
    expect(box).toHaveTextContent("Company name is kept as typed (“Sunrise”). The registration has “Sunrise Garments”.");
  });

  it("shows nothing when it was never checked, or has no GSTIN", async () => {
    customerForm({ initial });
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/customer/gstin/${GSTIN}/check`));
    expect(screen.queryByRole("status", { name: "GSTIN check" })).not.toBeInTheDocument();

    get.mockClear();
    customerForm({ initial: { ...initial, _id: "c2", gstin: "" } });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls.some(([url]) => String(url).includes("/gstin/"))).toBe(false);
  });

  it("a new customer asks for no earlier check", async () => {
    customerForm();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls.some(([url]) => String(url).includes("/gstin/"))).toBe(false);
  });
});

describe("Verify on the supplier form", () => {
  it("fills the name, the address on one line and the PAN, and marks a composition dealer", async () => {
    const a = answer();
    post.mockResolvedValue({ ...a, portal: portal({ taxpayerType: "Composition" }), fill: { ...a.fill!, gstRegistration: "composition" } });
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    supplierForm({ onSubmit });
    expect(screen.getByLabelText("GST registration")).toHaveValue("regular");
    await user.type(screen.getByLabelText("GSTIN"), GSTIN);
    await user.click(verifyButton());

    expect(post).toHaveBeenCalledWith(`/supplier/gstin/${GSTIN}/verify`, {}, expect.anything());
    const box = await result();
    expect(box).toHaveTextContent("Filled in: Supplier name, Address, PAN, GST registration (composition dealer).");
    expect(screen.getByLabelText("Supplier name *")).toHaveValue("Sunrise Garments");
    expect(screen.getByLabelText("Address")).toHaveValue("12/4, 2nd Floor, Sunrise Towers, Avinashi Road, Tiruppur, Tamil Nadu - 641603");
    expect(screen.getByLabelText("PAN")).toHaveValue("AAECB1234F");
    expect(screen.getByLabelText("GST registration")).toHaveValue("composition");

    await user.click(screen.getByRole("button", { name: /add supplier|save|create/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Sunrise Garments", gstin: GSTIN, pan: "AAECB1234F", gstRegistration: "composition" });
  });

  it("a supplier marked unregistered whose GSTIN is live becomes regular, and their own address stays", async () => {
    post.mockResolvedValue(answer());
    const user = userEvent.setup();
    supplierForm({ initial: { _id: "s1", name: "Sunrise Garments", gstin: GSTIN, address: "Old Mill Road, Erode", gstRegistration: "unregistered" } as Supplier });
    await user.click(verifyButton());
    const box = await result();
    expect(box).toHaveTextContent("Filled in: PAN, GST registration (regular).");
    expect(box).toHaveTextContent("Address is kept as typed (“Old Mill Road, Erode”).");
    expect(screen.getByLabelText("GST registration")).toHaveValue("regular");
    expect(screen.getByLabelText("Address")).toHaveValue("Old Mill Road, Erode");
  });
});
