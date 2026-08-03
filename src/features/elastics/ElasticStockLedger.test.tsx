import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ElasticStockCard } from "./ElasticStockCard";

// ══════════════════════════════════════════════════════════════════
//  READING A STOCK LEDGER
//
//  The document someone reconciles a warehouse against. It has to say,
//  for every line: what happened, how many metres moved, and what the
//  three figures came to afterwards — on hand, reserved, available.
//
//  It used to print the raw enum for "what happened", and carried one
//  balance. A reservation therefore read as "RESERVATION_HOLD, +0,
//  balance unchanged": a line that appears to have done nothing, on
//  the very event that made 400 m unsellable.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return {
    ...actual,
    httpClient: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
  };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const row = (over: Record<string, unknown> = {}) => ({
  _id: Math.random().toString(36).slice(2),
  date: "2026-08-01T00:00:00.000Z",
  type: "PACKING_INWARD",
  applied: 1000,
  balance: 1000,
  reservedApplied: 0,
  reservedBalance: 0,
  available: 1000,
  reason: "",
  refType: "",
  ...over,
});

const setLedger = (movements: ReturnType<typeof row>[], elastic = {}) => {
  get.mockResolvedValue({
    success: true,
    elastic: {
      _id: "e1",
      name: "20mm",
      stock: 1000,
      reservedStock: 0,
      available: 1000,
      minStock: 0,
      isLowStock: false,
      quantityProduced: 1000,
      ...elastic,
    },
    movements,
    page: 1,
    limit: 10,
    total: movements.length,
  });
};

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ElasticStockCard elasticId="e1" />
    </QueryClientProvider>
  );

/** The table row whose movement column reads `label`. */
const ledgerRow = async (label: string) => {
  const cell = await screen.findByText(label);
  return cell.closest("tr")!;
};

beforeEach(() => {
  get.mockReset();
});

describe("what each line says happened", () => {
  it("uses the words the floor uses, not the enum", async () => {
    setLedger([
      row({ type: "PACKING_INWARD" }),
      row({ type: "DC_OUT", applied: -400, balance: 600, available: 600 }),
      row({ type: "RESERVATION_HOLD", applied: 0 }),
    ]);
    renderCard();

    expect(await screen.findByText("Produced in")).toBeInTheDocument();
    expect(screen.getByText("Dispatched")).toBeInTheDocument();
    expect(screen.getByText("Reserved for order")).toBeInTheDocument();
    expect(screen.queryByText("PACKING_INWARD")).not.toBeInTheDocument();
    expect(screen.queryByText("DC_OUT")).not.toBeInTheDocument();
  });
});

describe("a reservation line", () => {
  it("shows the reserved quantity rather than a zero in the goods column", async () => {
    // The whole complaint. Reserving 400 m moved no goods and made
    // 400 m unsellable; a line reading "+0, balance 1000" says the
    // first part and hides the second.
    setLedger([
      row({
        type: "RESERVATION_HOLD",
        applied: 0,
        balance: 1000,
        reservedApplied: 400,
        reservedBalance: 400,
        available: 600,
      }),
    ]);
    renderCard();

    const tr = await ledgerRow("Reserved for order");
    expect(within(tr).getByText("+400")).toBeInTheDocument();
    // Goods untouched, and said as "nothing here" rather than "+0".
    expect(within(tr).queryByText("+0")).not.toBeInTheDocument();
    // And what it left behind on all three figures.
    expect(within(tr).getByText("1,000")).toBeInTheDocument();
    expect(within(tr).getByText("600")).toBeInTheDocument();
  });
});

describe("a dispatch line", () => {
  it("shows the goods leaving and the promise being kept on one row", async () => {
    // Both halves of one movement. Splitting them across two rows is
    // what let the goods half go missing.
    setLedger([
      row({
        type: "DC_OUT",
        applied: -400,
        balance: 600,
        reservedApplied: -400,
        reservedBalance: 0,
        available: 600,
        reason: "DC ELA-2026-27-0001; 400 against order reservation",
      }),
    ]);
    renderCard();

    const tr = await ledgerRow("Dispatched");
    // Twice over: 400 m of goods gone, and 400 m of promise discharged.
    expect(within(tr).getAllByText("-400")).toHaveLength(2);
    expect(within(tr).getByText(/against order reservation/)).toBeInTheDocument();
  });
});

describe("lines written before reservations were tracked", () => {
  it("says the figure is unknown rather than showing a confident zero", async () => {
    // A row from before the reserved balance existed knows nothing
    // about it. Printing 0 would be a claim this code cannot make.
    setLedger([
      row({
        type: "DC_OUT",
        applied: -400,
        balance: 600,
        reservedApplied: 0,
        reservedBalance: null,
        available: null,
      }),
    ]);
    renderCard();

    const tr = await ledgerRow("Dispatched");
    expect(within(tr).getByText("-400")).toBeInTheDocument();
    expect(within(tr).queryByText("0")).not.toBeInTheDocument();
  });
});

describe("the figures above the ledger", () => {
  it("states on hand, reserved and available separately", async () => {
    setLedger([], { stock: 1000, reservedStock: 400, available: 600 });
    renderCard();

    expect(await screen.findByText("In stock (m)")).toBeInTheDocument();
    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.getByText("600")).toBeInTheDocument();
  });
});
