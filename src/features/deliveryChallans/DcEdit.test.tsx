import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DcEditModal, linesChanged, linesFromDc } from "./DcEditModal";
import { DeliveryChallan } from "./types";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  EDITING A CHALLAN THAT HAS ALREADY BEEN RAISED
//
//  A delivery challan is not a description of a despatch, it IS the
//  despatch: cutting one takes goods off the shelf and settles part of
//  the order's reservation. So this form is unlike every other edit
//  form in the app — changing a line here moves stock.
//
//  Two things follow, and they are what these tests hold:
//
//    • `items` goes on the wire ONLY when the lines really changed.
//      The server reverses and re-applies whatever it is sent, so
//      including them unconditionally would stamp a
//      DC_CANCEL_RETURN / DC_OUT pair into the elastic's ledger every
//      time somebody corrected a lorry number.
//
//    • a line must name its elastic. The server skips lines without
//      one, so a blank line would produce a challan saying goods went
//      out while the shelf still counted them — silently, and only
//      visible at the next stock count.
//
//  Delivered and cancelled challans never reach this form; the button
//  is not rendered for them and the server refuses them by name.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const updateMutate = vi.fn();

vi.mock("./hooks", () => ({
  useDcMutations: () => ({ update: { mutate: updateMutate, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/features/elastics/api", () => ({
  elasticService: {
    list: vi.fn().mockResolvedValue({
      elastics: [
        { _id: "e1", name: "20mm Woven" },
        { _id: "e2", name: "32mm Knitted" },
      ],
    }),
  },
}));

const dc = {
  _id: "dc1",
  __v: 4,
  dcNumber: "DC/25-26/0007",
  type: "elastic",
  status: "draft",
  customerName: "Ravi Textiles",
  vehicleNo: "TN 38 AB 1234",
  totalQuantity: 500,
  items: [
    { _id: "i1", elastic: { _id: "e1", name: "20mm Woven" }, elasticName: "20mm Woven", quantity: 500, rate: 12 },
  ],
} as unknown as DeliveryChallan;

const setup = (challan: DeliveryChallan = dc) =>
  render(<DcEditModal dc={challan} open onClose={() => {}} />);

/** Fill the mandatory reason so the save can get past the guard. */
const giveReason = async (user: ReturnType<typeof userEvent.setup>) =>
  user.type(screen.getByPlaceholderText(/why is this being changed/i), "Customer cut the order");

beforeEach(() => {
  toast.mockClear();
  updateMutate.mockClear();
});

describe("what the edit form sends", () => {
  it("omits items when only the lorry details changed, so no stock moves", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText(/vehicle no/i));
    await user.type(screen.getByLabelText(/vehicle no/i), "TN 38 ZZ 9999");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const body = updateMutate.mock.calls[0][0];
    expect(body.vehicleNo).toBe("TN 38 ZZ 9999");
    // The load-bearing assertion: absent, not empty.
    expect(body).not.toHaveProperty("items");
    // And the version the form was opened on: a save after someone else
    // changed the challan is refused (409) instead of replacing theirs.
    expect(body.expectedVersion).toBe(4);
  });

  it("sends items when a quantity changed, carrying the elastic id", async () => {
    const user = userEvent.setup();
    setup();

    const qty = screen.getByLabelText(/^quantity$/i);
    await user.clear(qty);
    await user.type(qty, "300");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    const body = updateMutate.mock.calls[0][0];
    expect(body.items).toEqual([
      expect.objectContaining({ elastic: "e1", quantity: 300 }),
    ]);
    expect(body.auditReason).toBe("Customer cut the order");
  });

  it("warns on screen as soon as the lines differ", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByText(/stock will move/i)).not.toBeInTheDocument();
    const qty = screen.getByLabelText(/^quantity$/i);
    await user.clear(qty);
    await user.type(qty, "300");
    expect(screen.getByText(/stock will move/i)).toBeInTheDocument();
  });
});

describe("what the edit form refuses to send", () => {
  it("will not save without a reason", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/reason/i), "error");
  });

  it("will not save a line with no quantity", async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(screen.getByLabelText(/^quantity$/i));
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/greater than 0/i), "error");
  });

  it("will not save an elastic line that names no elastic", async () => {
    const user = userEvent.setup();
    setup({
      ...dc,
      items: [{ elasticName: "Typed by hand", quantity: 100, rate: 10 }],
    } as unknown as DeliveryChallan);

    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateMutate).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.stringMatching(/moves no stock/i),
      "error"
    );
  });
});

describe("an edit that ships more than is in stock", () => {
  const refused = new ApiError(
    "Not enough in stock for this challan — 20mm Woven: shipping 900, 600 in stock.",
    409, undefined, "DC_STOCK_SHORT",
    {
      code: "DC_STOCK_SHORT",
      details: {
        shortfalls: [{ elastic: "e1", name: "20mm Woven", shipping: 900, onHand: 600, short: 300 }],
        minReasonLength: 8,
      },
    }
  );

  it("asks why, then resends the same edit with the reason", async () => {
    const user = userEvent.setup();
    updateMutate.mockImplementationOnce((_b, opts) => opts.onError(refused));
    setup();

    const qty = screen.getByLabelText(/^quantity$/i);
    await user.clear(qty);
    await user.type(qty, "900");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    // No toast for the refusal: the prompt is the answer to it.
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByText("Shipping 900 · In stock 600 · Short 300")).toBeInTheDocument();

    // Too short a reason is not sent.
    await user.type(screen.getByLabelText(/reason for sending more/i), "short");
    await user.click(screen.getByRole("button", { name: /send anyway/i }));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/reason for sending more/i), " box packed today");
    await user.click(screen.getByRole("button", { name: /send anyway/i }));

    expect(updateMutate).toHaveBeenCalledTimes(2);
    const [first, second] = updateMutate.mock.calls.map((c) => c[0]);
    expect(first).not.toHaveProperty("stockShortfallReason");
    expect(second).toEqual({ ...first, stockShortfallReason: "short box packed today" });
  });

  it("shows a refusal that comes back even with a reason as an error", async () => {
    const user = userEvent.setup();
    updateMutate
      .mockImplementationOnce((_b, opts) => opts.onError(refused))
      .mockImplementationOnce((_b, opts) => opts.onError(refused));
    setup();

    await user.clear(screen.getByLabelText(/^quantity$/i));
    await user.type(screen.getByLabelText(/^quantity$/i), "900");
    await giveReason(user);
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await user.type(screen.getByLabelText(/reason for sending more/i), "box packed today");
    await user.click(screen.getByRole("button", { name: /send anyway/i }));

    expect(updateMutate).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/not enough in stock/i), "error");
  });
});

describe("linesChanged", () => {
  const base = linesFromDc(dc);

  it("is false for the untouched lines", () => {
    expect(linesChanged(base, linesFromDc(dc))).toBe(false);
  });

  it("ignores a change of numeric formatting", () => {
    // "500" and "500.00" are the same despatch; re-issuing stock over a
    // trailing zero would be absurd.
    expect(linesChanged(base, [{ ...base[0], quantity: "500.00" }])).toBe(false);
  });

  it("is true when the quantity moves", () => {
    expect(linesChanged(base, [{ ...base[0], quantity: "300" }])).toBe(true);
  });

  it("is true when the elastic is swapped", () => {
    expect(linesChanged(base, [{ ...base[0], elastic: "e2" }])).toBe(true);
  });

  it("is true when a line is added or removed", () => {
    expect(linesChanged(base, [...base, { ...base[0] }])).toBe(true);
    expect(linesChanged(base, [])).toBe(true);
  });
});

describe("linesFromDc", () => {
  it("reads the elastic id whether the API populated it or not", () => {
    expect(linesFromDc(dc)[0].elastic).toBe("e1");
    const flat = { ...dc, items: [{ elastic: "e9", quantity: 5, rate: 1 }] } as unknown as DeliveryChallan;
    expect(linesFromDc(flat)[0].elastic).toBe("e9");
  });

  it("gives an empty challan one blank line to start from", () => {
    const empty = { ...dc, items: [] } as unknown as DeliveryChallan;
    expect(linesFromDc(empty)).toHaveLength(1);
  });
});
