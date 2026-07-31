import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaterialLots } from "./MaterialLots";
import { LotTrace, YarnLot } from "./types";

const createMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const statusMutate = vi.fn((_a: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
const toast = vi.fn();

let trace: LotTrace | undefined;

vi.mock("./hooks", () => ({
  useLotMutations: () => ({
    create: { mutate: createMutate, isPending: false },
    setStatus: { mutate: statusMutate, isPending: false },
  }),
  useLotTrace: () => ({ data: trace, isLoading: false }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const lot = (over: Partial<YarnLot> = {}): YarnLot => ({
  _id: "lot1",
  rawMaterial: "mat1",
  lotNo: "D-4471",
  shade: "Off White",
  receivedQty: 100,
  consumedQty: 20,
  balance: 80,
  status: "open",
  ...over,
});

const renderLots = (lots: YarnLot[] = [], unplaced = 500) =>
  render(<MaterialLots materialId="mat1" lots={lots} unplaced={unplaced} />);

describe("MaterialLots", () => {
  beforeEach(() => {
    createMutate.mockClear();
    statusMutate.mockClear();
    toast.mockClear();
    trace = undefined;
  });

  it("points at the two ways a lot gets recorded when there are none", () => {
    renderLots();
    expect(screen.getByText("No lots recorded")).toBeInTheDocument();
  });

  it("totals only open lots on the rack", () => {
    renderLots([
      lot({ _id: "a", lotNo: "D-1", balance: 80 }),
      lot({ _id: "b", lotNo: "D-2", balance: 30, status: "quarantined" }),
      lot({ _id: "c", lotNo: "D-3", balance: 0, status: "exhausted" }),
    ]);
    expect(screen.getByText(/80 kg on the rack/)).toBeInTheDocument();
  });

  it("says plainly that lot balances will not match stock", () => {
    // The counters measure different things — stock is committed at order
    // approval, a lot is drawn when yarn leaves the rack. Left unsaid,
    // the mismatch reads as a bug.
    renderLots([lot()]);
    expect(screen.getByText(/will not match stock/i)).toBeInTheDocument();
  });

  it("shows each lot's received, issued and remaining", () => {
    renderLots([lot()]);
    expect(screen.getByText("D-4471")).toBeInTheDocument();
    expect(screen.getByText(/received 100 · issued 20/)).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
  });

  it("holds a lot back", async () => {
    renderLots([lot()]);
    await userEvent.click(screen.getByRole("button", { name: /hold/i }));
    expect(statusMutate).toHaveBeenCalledWith(
      { id: "lot1", status: "quarantined" },
      expect.anything()
    );
    expect(toast).toHaveBeenCalledWith("Lot D-4471 held back", "success");
  });

  it("releases a quarantined lot instead of offering to hold it again", async () => {
    renderLots([lot({ status: "quarantined" })]);
    expect(screen.queryByRole("button", { name: /hold/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /release/i }));
    expect(statusMutate).toHaveBeenCalledWith(
      { id: "lot1", status: "open" },
      expect.anything()
    );
  });

  it("opens a lot by hand for yarn already on the rack", async () => {
    renderLots();
    await userEvent.click(screen.getByRole("button", { name: /add lot/i }));
    await userEvent.type(screen.getByLabelText(/lot no/i), "LEGACY-1");
    await userEvent.type(screen.getByLabelText(/quantity/i), "75");
    await userEvent.click(screen.getByRole("button", { name: /open lot/i }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ rawMaterial: "mat1", lotNo: "LEGACY-1", quantity: 75 }),
      expect.anything()
    );
  });

  it("refuses a lot with no quantity", async () => {
    renderLots();
    await userEvent.click(screen.getByRole("button", { name: /add lot/i }));
    await userEvent.type(screen.getByLabelText(/lot no/i), "X-1");
    await userEvent.click(screen.getByRole("button", { name: /open lot/i }));

    expect(createMutate).not.toHaveBeenCalled();
  });

  it("traces a lot forward to the job and customer it reached", async () => {
    trace = {
      lot: lot(),
      issuedQty: 40,
      batches: [
        {
          batchId: "b1",
          batchNo: "WB-0001",
          status: "issued",
          beamNos: [1, 2],
          quantity: 40,
          job: { _id: "j1", jobOrderNo: 812 },
          order: { _id: "o1", orderNo: 55, po: "PO-9001", customer: "Aravind Garments" },
        },
      ],
    };
    renderLots([lot()]);
    await userEvent.click(screen.getByRole("button", { name: /trace/i }));

    const dialog = screen.getByText("WB-0001").closest("div")!.parentElement!;
    expect(within(dialog).getByText(/Job #812/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Aravind Garments/)).toBeInTheDocument();
    expect(within(dialog).getByText("40 kg")).toBeInTheDocument();
    expect(screen.getByText(/issued across 1 live batch/)).toBeInTheDocument();
  });

  it("says a lot has not been issued rather than showing an empty trail", async () => {
    trace = { lot: lot(), issuedQty: 0, batches: [] };
    renderLots([lot()]);
    await userEvent.click(screen.getByRole("button", { name: /trace/i }));
    expect(screen.getByText("Not issued yet")).toBeInTheDocument();
  });
});

describe("a lot only claims stock that exists", () => {
  beforeEach(() => {
    createMutate.mockClear();
    toast.mockClear();
  });

  it("reports what is still unassigned", () => {
    renderLots([lot()], 120);
    expect(screen.getByText(/not yet assigned to a lot/)).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("says so when everything is already accounted for", () => {
    renderLots([lot()], 0);
    expect(screen.getByText("All stock is accounted for by lots")).toBeInTheDocument();
  });

  it("will not open the form with nothing left to assign", () => {
    // The whole point: a lot is an assignment of stock that exists.
    renderLots([lot()], 0);
    expect(screen.getByRole("button", { name: /add lot/i })).toBeDisabled();
  });

  it("shows the ceiling on the quantity field", async () => {
    renderLots([], 120);
    await userEvent.click(screen.getByRole("button", { name: /add lot/i }));
    expect(screen.getByLabelText(/Quantity \(kg\) — up to 120/)).toBeInTheDocument();
  });

  it("refuses a quantity beyond what is unassigned", async () => {
    renderLots([], 120);
    await userEvent.click(screen.getByRole("button", { name: /add lot/i }));
    await userEvent.type(screen.getByLabelText(/lot no/i), "H-1");
    await userEvent.type(screen.getByLabelText(/Quantity/i), "500");
    await userEvent.click(screen.getByRole("button", { name: /open lot/i }));

    expect(await screen.findByText(/Only 120 is unassigned/)).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("accepts exactly what is unassigned", async () => {
    renderLots([], 120);
    await userEvent.click(screen.getByRole("button", { name: /add lot/i }));
    await userEvent.type(screen.getByLabelText(/lot no/i), "H-1");
    await userEvent.type(screen.getByLabelText(/Quantity/i), "120");
    await userEvent.click(screen.getByRole("button", { name: /open lot/i }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ lotNo: "H-1", quantity: 120 }),
      expect.anything()
    );
  });
});
