import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MaterialLots } from "./MaterialLots";
import type { LotCertificateRead, LotCompare, YarnLot } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A LOT'S TEST CERTIFICATE
//
//  Read from a photo onto the lot, with what is outside its own range
//  marked; typed in when there is no reader; a kept one shown, corrected
//  or replaced. The certified lots of the yarn side by side, and lots
//  found by a property.
// ══════════════════════════════════════════════════════════════════

const saveMutate = vi.fn();
const readLotCertificate = vi.fn();
const compareLots = vi.fn();
const searchLotCertificates = vi.fn();
vi.mock("./hooks", () => ({
  useLotMutations: () => ({ create: { mutate: vi.fn(), isPending: false }, setStatus: { mutate: vi.fn(), isPending: false }, saveCertificate: { mutate: saveMutate, isPending: false } }),
  useLotTrace: () => ({ data: undefined, isLoading: false }),
  useLot: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("./api", () => ({ materialService: {
  readLotCertificate: (...a: unknown[]) => readLotCertificate(...a), compareLots: (...a: unknown[]) => compareLots(...a), searchLotCertificates: (...a: unknown[]) => searchLotCertificates(...a),
} }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const lot = (over: Partial<YarnLot> = {}): YarnLot => ({ _id: "lot1", rawMaterial: "mat1", lotNo: "L-4471", shade: "Raw white", receivedQty: 400, consumedQty: 0, balance: 400, status: "open", ...over });
const kept = {
  certNo: "TC/2611/044", date: "2026-11-02T00:00:00.000Z", issuer: "Sri Yarn Traders", product: "Nylon 70D", result: "pass" as const, byName: "Owner", at: "2026-11-13T05:00:00Z",
  tests: [
    { key: "tenacity", label: "Tenacity", value: 4.6, unit: "g/den", min: 4.2, max: null },
    { key: "elongation", label: "Elongation at break", value: 33, unit: "%", min: 24, max: 32 },
  ],
  flags: [{ code: "OUT_OF_SPEC", severity: "danger" as const, message: "Elongation 33 % is above the 32 the certificate itself gives" }],
};
const readResult: LotCertificateRead = {
  read: { problem: null, issuer: "Sri Yarn Traders", certNo: "TC/2611/044", date: "2026-11-02", lotNo: "L-4471", result: "pass" },
  lot: { _id: "lot1", lotNo: "L-4471", shade: "Raw white", status: "open", rawMaterial: "mat1", materialName: "Nylon 70D", supplierName: "Sri Yarn Traders", hasCertificate: false },
  candidates: [], tests: kept.tests, history: {}, checks: [{ ...kept.flags[0], key: "elongation" }], aiSuggestion: "ai-tc-1",
};
const compare: LotCompare = {
  lots: [{ _id: "lot1", lotNo: "L-4471", shade: "", status: "open", certNo: "TC/2611/044", date: "2026-11-02T00:00:00.000Z", result: "pass", flags: 1 }, { _id: "lot2", lotNo: "L-4402", shade: "", status: "open", certNo: "TC/L-4402", date: "2026-10-01T00:00:00.000Z", result: "", flags: 0 }],
  rows: [
    { key: "tenacity", label: "Tenacity", unit: "g/den", cells: [{ value: 4.6, min: 4.2, max: null, outOfSpec: false }, { value: 4.7, min: null, max: null, outOfSpec: false }], avg: 4.65, low: 4.6, high: 4.7 },
    { key: "elongation", label: "Elongation", unit: "%", cells: [{ value: 33, min: 24, max: 32, outOfSpec: true }, null], avg: 33, low: 33, high: 33 },
  ],
  keys: [{ key: "tenacity", label: "Tenacity", unit: "g/den" }, { key: "elongation", label: "Elongation", unit: "%" }],
};
const wrap = (lots: YarnLot[]) => render(<QueryClientProvider client={new QueryClient()}><MaterialLots materialId="mat1" lots={lots} unplaced={0} /></QueryClientProvider>);

beforeEach(() => {
  for (const f of [saveMutate, readLotCertificate, compareLots, searchLotCertificates]) f.mockReset();
  compareLots.mockResolvedValue(compare);
});

describe("a lot's test certificate", () => {
  it("read from a photo: what is outside its own range is marked; kept with the read", async () => {
    readLotCertificate.mockResolvedValue(readResult);
    wrap([lot()]);
    await userEvent.click(screen.getByRole("button", { name: "Test certificate of lot L-4471" }));
    await userEvent.upload(screen.getByLabelText("Certificate photo"), new File(["x"], "tc.jpg", { type: "image/jpeg" }));
    const form = await screen.findByLabelText("The certificate to keep");
    expect(readLotCertificate).toHaveBeenCalledWith([expect.any(File)], "lot1");
    expect(screen.getByLabelText("Checks on the certificate")).toHaveTextContent("Elongation 33 % is above the 32");
    expect(within(form).getByLabelText("Certificate no.")).toHaveValue("TC/2611/044");
    expect(within(form).getByLabelText("Property 2")).toHaveValue("Elongation at break");
    expect(within(form).getByText("out of range")).toBeInTheDocument();
    await userEvent.click(within(form).getByRole("button", { name: "Keep the certificate" }));
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toMatchObject({ id: "lot1", body: {
      certNo: "TC/2611/044", date: "2026-11-02", issuer: "Sri Yarn Traders", result: "pass", aiSuggestion: "ai-tc-1",
      tests: [{ key: "tenacity", label: "Tenacity", value: 4.6, unit: "g/den", min: 4.2, max: null }, { key: "elongation", label: "Elongation at break", value: 33, unit: "%", min: 24, max: 32 }],
    } });
  });

  it("typed in when there is no reader", async () => {
    wrap([lot()]);
    await userEvent.click(screen.getByRole("button", { name: "Test certificate of lot L-4471" }));
    await userEvent.click(screen.getByRole("button", { name: "Type it in instead" }));
    const form = screen.getByLabelText("The certificate to keep");
    const keep = within(form).getByRole("button", { name: "Keep the certificate" });
    expect(keep).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("Property 1"), "Denier");
    await userEvent.type(within(form).getByLabelText("Value 1"), "70.2");
    await userEvent.type(within(form).getByLabelText("Unit 1"), "den");
    await userEvent.click(keep);
    expect(readLotCertificate).not.toHaveBeenCalled();
    expect(saveMutate.mock.calls[0][0].body).toMatchObject({ aiSuggestion: undefined, tests: [{ label: "Denier", value: 70.2, unit: "den", min: null, max: null }] });
  });

  it("a kept certificate: marked on the lot, shown with what was out of range, and corrected", async () => {
    wrap([lot({ certificate: kept })]);
    expect(screen.getByText("certificate: out of range")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Test certificate of lot L-4471" }));
    const view = screen.getByLabelText("The certificate kept");
    expect(view).toHaveTextContent("Sri Yarn Traders · TC/2611/044");
    expect(within(view).getByText("33 %")).toHaveClass("text-status-danger");
    expect(within(view).getByLabelText("Checks when it was kept")).toHaveTextContent("above the 32");
    await userEvent.click(within(view).getByRole("button", { name: "Correct it" }));
    const form = screen.getByLabelText("The certificate to keep");
    await userEvent.clear(within(form).getByLabelText("Value 2"));
    await userEvent.type(within(form).getByLabelText("Value 2"), "31");
    await userEvent.click(within(form).getByRole("button", { name: "Keep the certificate" }));
    expect(saveMutate.mock.calls[0][0].body.tests[1]).toMatchObject({ key: "elongation", value: 31 });
  });
});

describe("lots compared by their certificates", () => {
  it("side by side, the out-of-range value marked; lots found by a property", async () => {
    searchLotCertificates.mockResolvedValue([{ _id: "lot2", lotNo: "L-4402", shade: "", status: "open", rawMaterial: "mat1", materialName: "Nylon 70D", supplierName: "", hasCertificate: true, balance: 100, value: 4.7, unit: "g/den", min: null, max: null, certNo: "TC/L-4402", date: null, outOfSpec: false }]);
    wrap([lot({ certificate: kept }), lot({ _id: "lot2", lotNo: "L-4402" })]);
    const table = await screen.findByRole("table", { name: "Certified lots side by side" });
    expect(compareLots).toHaveBeenCalledWith("mat1");
    const elong = within(table).getByText("Elongation").closest("tr")!;
    // The lot's own value is marked; the average beside it is not.
    const [value, average] = within(elong).getAllByText("33");
    expect(value).toHaveClass("text-status-danger");
    expect(average).not.toHaveClass("text-status-danger");
    expect(within(table).getByText("Tenacity").closest("tr")).toHaveTextContent("4.65");
    await userEvent.type(screen.getByLabelText("From"), "4.65");
    await userEvent.click(screen.getByRole("button", { name: "Find lots" }));
    await waitFor(() => expect(searchLotCertificates).toHaveBeenCalledWith({ material: "mat1", key: "tenacity", min: 4.65, max: "" }));
    expect(await screen.findByLabelText("Lots found")).toHaveTextContent("L-4402");
  });
});
