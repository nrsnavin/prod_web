import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StockTakeModal } from "./StockOps";
import type { RawMaterial } from "./types";

// ══════════════════════════════════════════════════════════════════
//  STOCK TAKE ON A SHEET
//
//  The materials on screen go out as an Excel sheet with the counted
//  column blank; the filled sheet comes back and fills the boxes, and
//  posting adjusts only what differs — each a ledger entry, as the
//  on-screen count always did.
// ══════════════════════════════════════════════════════════════════

const stockTakeSheet = vi.fn();
const stockTakePreview = vi.fn();
vi.mock("./api", () => ({
  materialService: {
    stockTakeSheet: (ids?: string[]) => stockTakeSheet(ids),
    stockTakePreview: (file: File) => stockTakePreview(file),
  },
}));
const post = vi.fn();
vi.mock("@/core/http/httpClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/http/httpClient")>();
  return { ...actual, httpClient: { ...actual.httpClient, post: (...a: unknown[]) => post(...a) } };
});
vi.mock("@/features/suppliers/api", () => ({ poService: {} }));
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const material = (over: Partial<RawMaterial> & { _id: string; name: string; stock: number }): RawMaterial =>
  ({ category: "covering", price: 300, minStock: 0, unit: "kg", archived: false, ...over }) as RawMaterial;
const nylon = material({ _id: "m1", name: "Nylon 70D", stock: 100 });
const spandex = material({ _id: "m2", name: "Spandex 40D", stock: 250.5, category: "rubber" });

function open(materials = [nylon, spandex]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StockTakeModal materials={materials} onClose={() => {}} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  stockTakeSheet.mockReset();
  stockTakePreview.mockReset();
  post.mockReset();
  toast.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:sheet");
  URL.revokeObjectURL = vi.fn();
});

describe("the stock take sheet", () => {
  it("downloads a sheet for the materials shown", async () => {
    stockTakeSheet.mockResolvedValue(new Blob(["x"]));
    open();
    await userEvent.click(screen.getByRole("button", { name: /download sheet/i }));
    await waitFor(() => expect(stockTakeSheet).toHaveBeenCalledWith(["m1", "m2"]));
    expect(screen.getByText("2 materials shown go on the sheet, with the counted column blank.")).toBeInTheDocument();
  });

  it("fills the counted boxes from the filled sheet, says what it could not use, and posts only the differences", async () => {
    stockTakePreview.mockResolvedValue({
      success: true, file: "stock-take.xlsx",
      rows: [
        { _id: "m1", name: "Nylon 70D", category: "covering", unit: "kg", archived: false, systemStock: 100, counted: 98, adjustment: -2 },
        { _id: "m2", name: "Spandex 40D", category: "rubber", unit: "kg", archived: false, systemStock: 250.5, counted: 250.5, adjustment: 0 },
        { _id: "m9", name: "Poly 150D", category: "weft", unit: "kg", archived: false, systemStock: 10, counted: 12, adjustment: 2 },
      ],
      blank: 1, unknown: [{ row: 6, name: "Unknown Yarn" }], errors: [{ row: 7, name: "Old Yarn", error: '"five" is not a quantity' }], changed: 2,
    });
    post.mockResolvedValue({ success: true });
    open();
    const file = new File([new Uint8Array([1, 2, 3])], "stock-take.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await userEvent.upload(screen.getByLabelText("Filled stock take sheet"), file);
    await waitFor(() => expect(stockTakePreview).toHaveBeenCalledWith(file));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("stock-take.xlsx: 2 counted, 1 left blank · 2 differ from the system.");
    expect(status).toHaveTextContent("Not shown here (change the filter to post them): Poly 150D.");
    expect(status).toHaveTextContent("Not a material here: Unknown Yarn (row 6).");
    expect(status).toHaveTextContent('Could not read: Old Yarn (row 7: "five" is not a quantity).');

    const boxes = screen.getAllByLabelText("Counted stock");
    expect(boxes[0]).toHaveValue(98);
    expect(boxes[1]).toHaveValue(250.5);
    expect(screen.getByText("1 variance to post")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /post adjustments/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/materials/bulk-adjust-stock", {
      adjustments: [{ _id: "m1", adjustment: -2, reason: "Stock take (sheet stock-take.xlsx)" }],
    }));
    expect(toast).toHaveBeenCalledWith("Stock take posted — 1 adjustments", "success");
  });

  it("a figure typed over the sheet's wins", async () => {
    stockTakePreview.mockResolvedValue({
      success: true, file: "s.xlsx",
      rows: [{ _id: "m1", name: "Nylon 70D", category: "covering", unit: "kg", archived: false, systemStock: 100, counted: 98, adjustment: -2 }],
      blank: 1, unknown: [], errors: [], changed: 1,
    });
    open();
    await userEvent.upload(screen.getByLabelText("Filled stock take sheet"), new File(["x"], "s.xlsx"));
    const box = (await screen.findAllByLabelText("Counted stock"))[0];
    await waitFor(() => expect(box).toHaveValue(98));
    await userEvent.clear(box);
    await userEvent.type(box, "97");
    expect(within(box.closest("div")!.parentElement!).getByText("-3")).toBeInTheDocument();
  });
});
