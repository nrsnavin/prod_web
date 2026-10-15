import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DcBulkActions, dcsCsv } from "./DcBulkActions";
import { DeliveryChallan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE CHALLAN LIST'S MULTI-SELECT
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const statusMutate = vi.fn();
const bulkPdf = vi.fn();
const saveBlob = vi.fn();

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./hooks", () => ({ useDcMutations: () => ({ bulkStatus: { mutate: statusMutate, isPending: false } }) }));
vi.mock("./api", () => ({ dcService: { bulkPdf: (ids: string[]) => bulkPdf(ids) } }));
vi.mock("@/features/elastics/ElasticBulkActions", () => ({
  saveBlob: (...a: unknown[]) => saveBlob(...a),
  ResultDialog: ({ result }: { result: { results: Array<{ reason?: string }> } }) =>
    <div>{result.results.map((r) => r.reason).join(" ")}</div>,
}));

const dc = (id: string, status: DeliveryChallan["status"]) =>
  ({ _id: id, dcNumber: `DC-${id}`, status, type: "elastic", customerName: "Acme", orderNo: 7, totalQuantity: 100 }) as DeliveryChallan;
const rows = [dc("1", "draft"), dc("2", "draft"), dc("3", "dispatched"), dc("4", "delivered")];

beforeEach(() => [toast, statusMutate, bulkPdf, saveBlob].forEach((f) => f.mockReset()));

describe("moving them on together", () => {
  it("marks only the drafts dispatched", async () => {
    const u = userEvent.setup();
    render(<DcBulkActions selected={rows} onClear={() => {}} />);
    await u.click(screen.getByRole("button", { name: "Mark dispatched (2)" }));
    expect(screen.getByText(/DC-1, DC-2 leave the draft state/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Mark dispatched" }));
    expect(statusMutate.mock.calls[0][0]).toEqual({ ids: ["1", "2"], status: "dispatched" });
  });

  it("marks only the dispatched ones delivered, and lists any refused", async () => {
    statusMutate.mockImplementationOnce((_v, opts) => opts.onSuccess({
      done: 0, refused: 1, results: [{ id: "3", ok: false, reason: "DC DC-3 is cancelled and cannot change again." }],
    }));
    const u = userEvent.setup();
    render(<DcBulkActions selected={rows} onClear={() => {}} />);
    await u.click(screen.getByRole("button", { name: "Mark delivered (1)" }));
    await u.click(screen.getByRole("button", { name: "Mark delivered" }));
    expect(statusMutate.mock.calls[0][0]).toEqual({ ids: ["3"], status: "delivered" });
    expect(screen.getByText(/cannot change again/)).toBeInTheDocument();
  });

  it("offers neither move when none is draft or dispatched", () => {
    render(<DcBulkActions selected={[dc("4", "delivered")]} onClear={() => {}} />);
    expect(screen.queryByRole("button", { name: /Mark/ })).not.toBeInTheDocument();
  });
});

it("prints them all as one PDF", async () => {
  bulkPdf.mockResolvedValue(new Blob(["%PDF"]));
  const u = userEvent.setup();
  render(<DcBulkActions selected={rows} onClear={() => {}} />);
  await u.click(screen.getByRole("button", { name: /Print/ }));
  expect(bulkPdf).toHaveBeenCalledWith(["1", "2", "3", "4"]);
  await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^challans-.*\.pdf$/)));
});

it("exports a row per challan", () => {
  expect(dcsCsv([dc("1", "draft")]).split("\r\n")[1]).toBe("DC-1,Acme,#7,Elastic,100,,,,draft");
});
