import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LotAge, LotLedger } from "./LotLedger";
import { LotAdjustDialog } from "./LotAdjustDialog";
import type { LotMovement, YarnLot } from "./types";

// ══════════════════════════════════════════════════════════════════
//  BATCH-WISE STOCK ON THE MATERIAL PAGE
//
//  A lot's balance was two running totals, and a running total cannot
//  be audited: it says a lot has 40 kg left without saying when the
//  rest went or who took it. These are the two things that fix that —
//  the row-by-row ledger, and how long the lot has sat on the rack.
// ══════════════════════════════════════════════════════════════════

let lotData: YarnLot | undefined;
let loading = false;
const adjustMutate = vi.fn();

vi.mock("./hooks", () => ({
  useLot: () => ({ data: lotData, isLoading: loading }),
  useLotMutations: () => ({
    adjust: { mutate: adjustMutate, isPending: false },
  }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const lot = (over: Partial<YarnLot> = {}): YarnLot =>
  ({
    _id: "lot1",
    rawMaterial: "m1",
    lotNo: "D-4471",
    shade: "Ecru",
    receivedQty: 100,
    consumedQty: 30,
    balance: 70,
    status: "open",
    ageDays: 45,
    ageBucket: "watch",
    ...over,
  }) as YarnLot;

const move = (over: Partial<LotMovement> = {}): LotMovement => ({
  date: "2026-06-10T00:00:00.000Z",
  type: "BATCH_ISSUE",
  typeLabel: "Issued to warping",
  quantity: -30,
  balance: 70,
  reference: "WB-0009",
  referenceId: "b1",
  ...over,
});

const renderLedger = () =>
  render(
    <MemoryRouter>
      <LotLedger lotId="lot1" />
    </MemoryRouter>
  );

beforeEach(() => {
  loading = false;
  adjustMutate.mockClear();
  lotData = lot({ movements: [move()] });
});

describe("a lot's ledger", () => {
  it("shows what happened, in words", () => {
    renderLedger();
    expect(screen.getByText("Issued to warping")).toBeInTheDocument();
    expect(screen.queryByText("BATCH_ISSUE")).not.toBeInTheDocument();
  });

  it("names the batch that drew the yarn", () => {
    renderLedger();
    expect(screen.getByRole("link", { name: "WB-0009" })).toBeInTheDocument();
  });

  it("writes the sign, because the direction is the point of the column", () => {
    renderLedger();
    expect(screen.getByText(/−/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it("shows a credit as a gain", () => {
    lotData = lot({
      movements: [move({ type: "INWARD", typeLabel: "Received", quantity: 100, balance: 100, reference: null, referenceId: null })],
    });
    renderLedger();
    expect(screen.getByText("Received")).toBeInTheDocument();
    expect(screen.getByText(/\+/)).toBeInTheDocument();
  });

  it("shows the reason on an adjustment, which has no document", () => {
    lotData = lot({
      movements: [
        move({
          type: "ADJUST",
          typeLabel: "Manual adjustment",
          quantity: -12,
          reference: null,
          referenceId: null,
          reason: "spillage",
          by: "Ravi",
        }),
      ],
    });
    renderLedger();
    expect(screen.getByText(/spillage/)).toBeInTheDocument();
    expect(screen.getByText(/Ravi/)).toBeInTheDocument();
  });

  it("explains an empty ledger rather than showing a bare table", () => {
    // Lots that predate this ledger have a balance and no rows. "No
    // movements" and "this is older than the ledger" are different
    // things and only one of them is true.
    lotData = lot({ movements: [] });
    renderLedger();
    expect(screen.getByText(/predates the lot ledger/i)).toBeInTheDocument();
  });
});

describe("how old a lot is", () => {
  const renderAge = (l: YarnLot) => render(<LotAge lot={l} />);

  it("says how many days it has been on the rack", () => {
    renderAge(lot());
    expect(screen.getByText("45d on rack")).toBeInTheDocument();
  });

  it("shows nothing for a lot that holds nothing", () => {
    // An exhausted lot's age is history, not something to act on, and
    // colouring it critical would bury the lots that matter.
    const { container } = renderAge(lot({ balance: 0, ageBucket: null, ageDays: 400 }));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the server never sent an age", () => {
    const { container } = renderAge(lot({ ageDays: undefined, ageBucket: undefined }));
    expect(container).toBeEmptyDOMElement();
  });
});

describe("adjusting a lot", () => {
  const renderDialog = (l = lot()) =>
    render(<LotAdjustDialog lot={l} onClose={vi.fn()} />);

  it("says the material's stock moves with it", () => {
    // Someone adjusting a lot has to know the aggregate follows —
    // otherwise they will adjust the material separately and
    // double-count the correction.
    renderDialog();
    expect(screen.getByText(/total stock moves by the same amount/i)).toBeInTheDocument();
  });

  it("will not submit without a reason", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Adjustment in kg"), "-12");
    expect(screen.getByRole("button", { name: /adjust lot/i })).toBeDisabled();

    await user.type(screen.getByLabelText("Reason for the adjustment"), "recount");
    expect(screen.getByRole("button", { name: /adjust lot/i })).toBeEnabled();
  });

  it("refuses to take more off than the lot holds", async () => {
    // Driving a lot negative would make the shade trail claim yarn that
    // was never there. The server refuses; saying so here saves the trip.
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Adjustment in kg"), "-500");
    await user.type(screen.getByLabelText("Reason for the adjustment"), "recount");

    expect(screen.getByText(/more than the 70 kg on this lot/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adjust lot/i })).toBeDisabled();
  });

  it("previews where the balance lands", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Adjustment in kg"), "-12");
    expect(screen.getByText(/70 → 58 kg/)).toBeInTheDocument();
  });

  it("warns that a lot taken to zero is exhausted", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Adjustment in kg"), "-70");
    expect(screen.getByText(/marked exhausted/i)).toBeInTheDocument();
  });

  it("sends the change and the reason", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Adjustment in kg"), "-12");
    await user.type(screen.getByLabelText("Reason for the adjustment"), "spillage");
    await user.click(screen.getByRole("button", { name: /adjust lot/i }));

    expect(adjustMutate.mock.calls[0][0]).toMatchObject({
      id: "lot1",
      delta: -12,
      reason: "spillage",
    });
  });

  it("refuses a zero change", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText("Adjustment in kg"), "0");
    await user.type(screen.getByLabelText("Reason for the adjustment"), "nothing");
    expect(screen.getByRole("button", { name: /adjust lot/i })).toBeDisabled();
  });
});
