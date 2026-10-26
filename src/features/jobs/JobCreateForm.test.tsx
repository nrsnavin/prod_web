import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobCreateForm, asShortfalls } from "./JobCreateForm";
import { ApiError } from "@/core/http/httpClient";
import type { OrderDetail, OrderElasticProgress } from "@/features/orders/types";

// The form's 20% rule has to agree with services/excessPlanning.js on
// the server. If it is stricter the planner cannot do something the
// system allows; if it is looser they get a 409 they were never warned
// about, after filling the whole form in.

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./hooks", () => ({
  useJobMutations: () => ({ create: { mutate: create, isPending: false } }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const line = (over: Partial<OrderElasticProgress> = {}): OrderElasticProgress => ({
  id: "e1",
  name: "Woven Elastic 25mm",
  ordered: 1000,
  produced: 0,
  delivered: 0,
  undelivered: 1000,
  packed: 0,
  notAssigned: 1000,
  pendingDelivery: 1000,
  // Deprecated alias for notAssigned, still on the type.
  pending: 1000,
  ...over,
});

const order = (over: Partial<OrderDetail> = {}): OrderDetail =>
  ({
    _id: "o1",
    orderNo: 91,
    elastics: [line()],
    rawMaterialRequired: [],
    excessPlanning: [],
    ...over,
  }) as unknown as OrderDetail;

const setQty = async (user: ReturnType<typeof userEvent.setup>, v: string) => {
  const box = screen.getByLabelText("Qty (m)");
  await user.clear(box);
  await user.type(box, v);
};

beforeEach(() => create.mockClear());

function renderForm(o = order()) {
  render(<JobCreateForm order={o} onClose={vi.fn()} onCreated={vi.fn()} />);
}

describe("planning inside the allowance", () => {
  it("takes the ordered quantity with no fuss", async () => {
    const user = userEvent.setup();
    renderForm();
    await setQty(user, "1000");
    expect(screen.queryByText(/needs a reason/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create job/i }));
    expect(create.mock.calls[0][0]).toMatchObject({
      elastics: [{ elastic: "e1", quantity: 1000 }],
    });
    expect(create.mock.calls[0][0].excessReason).toBeUndefined();
  });

  it("takes 20% over without asking why, but says the yarn will be drawn", async () => {
    const user = userEvent.setup();
    renderForm();
    await setQty(user, "1200");

    expect(screen.getByText(/200 m over \(20%\)/)).toBeInTheDocument();
    expect(screen.getByText(/deducted from stock when the job is created/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Why is more than 20%/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create job/i })).toBeEnabled();
  });
});

describe("planning past the allowance", () => {
  it("asks why, and will not submit until the reason is real", async () => {
    const user = userEvent.setup();
    renderForm();
    await setQty(user, "1500");

    expect(screen.getByText(/500 m over \(50%\) — needs a reason/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /create job/i });
    expect(button).toBeDisabled();

    // A token reason is not a reason — same 8-character floor as the server.
    await user.type(screen.getByRole("textbox", { name: /Why is more than 20%/i }), "ok");
    expect(button).toBeDisabled();
  });

  it("sends the reason once it is given", async () => {
    const user = userEvent.setup();
    renderForm();
    await setQty(user, "1500");
    await user.type(
      screen.getByRole("textbox", { name: /Why is more than 20%/i }),
      "Loom set for a full beam."
    );
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(create.mock.calls[0][0]).toMatchObject({
      excessReason: "Loom set for a full beam.",
    });
  });
});

describe("a line other jobs have already planned", () => {
  // The allowance is against the ORDERED figure, so a line already
  // planned to 110% has only 10% of headroom left — not another 20%.
  it("counts what earlier jobs already planned", async () => {
    const user = userEvent.setup();
    renderForm(order({
      elastics: [line({ notAssigned: 0, pending: 0 })],
    }));

    await setQty(user, "150");   // 1000 already planned + 150 = 15% over
    expect(screen.getByText(/150 m over \(15%\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create job/i })).toBeEnabled();

    await setQty(user, "250");   // 25% over — past the allowance
    expect(screen.getByText(/250 m over \(25%\) — needs a reason/)).toBeInTheDocument();
  });

  // The old form hid any line with nothing left to assign, which made
  // planning excess on it impossible from here.
  it("still offers a fully-planned line", () => {
    renderForm(order({
      elastics: [line({ notAssigned: 0, pending: 0, pendingDelivery: 0, packed: 1000 })],
    }));
    expect(screen.getByText("Woven Elastic 25mm")).toBeInTheDocument();
    expect(screen.getByLabelText("Qty (m)")).toBeInTheDocument();
  });
});

// ── Yarn short on paper ──────────────────────────────────────────────
// Stock that was never entered reads as short. The refusal offers to
// create the job anyway, with a reason; what is in stock is drawn.
describe("when the excess yarn is short", () => {
  const refuse = () =>
    create.mockImplementationOnce((_body, opts) =>
      opts.onError(new ApiError(
        "Not enough raw material for the excess quantity — Nylon 70D short by 0.3 kg",
        409, undefined, "INSUFFICIENT_STOCK_FOR_EXCESS",
        { details: { shortfalls: [{ rawMaterial: "m1", name: "Nylon 70D", required: 0.8, inStock: 0.5, short: 0.3 }] } }
      )));

  it("lists what is short and creates the job anyway with the reason", async () => {
    const user = userEvent.setup();
    renderForm();
    await setQty(user, "1100");
    refuse();
    await user.click(screen.getByRole("button", { name: /create job/i }));

    const dialog = await screen.findByRole("dialog", { name: /not enough yarn/i });
    expect(within(dialog).getByText("Nylon 70D")).toBeInTheDocument();
    expect(within(dialog).getByText(/Need 0\.80 kg · Available 0\.50 kg · Short 0\.30 kg/)).toBeInTheDocument();
    expect(within(dialog).getByText(/has not been entered yet/)).toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox"), "Stock not entered yet");
    await user.click(within(dialog).getByRole("button", { name: /create job anyway/i }));
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0]).toMatchObject({
      elastics: [{ elastic: "e1", quantity: 1100 }],
      force: true,
      forceReason: "Stock not entered yet",
    });
  });

  it("asks for a reason of at least 8 characters before trying again", async () => {
    const user = userEvent.setup();
    renderForm();
    await setQty(user, "1100");
    refuse();
    await user.click(screen.getByRole("button", { name: /create job/i }));
    const dialog = await screen.findByRole("dialog", { name: /not enough yarn/i });
    await user.type(within(dialog).getByRole("textbox"), "short");
    await user.click(within(dialog).getByRole("button", { name: /create job anyway/i }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText(/at least 8 characters/)).toBeInTheDocument();
  });

  it("maps the server's shortfalls to the dialog's", () => {
    expect(asShortfalls({ shortfalls: [{ rawMaterial: "m1", name: "Nylon", required: 1, inStock: 0, short: 1 }] }))
      .toEqual([{ materialId: "m1", materialName: "Nylon", required: 1, available: 0, short: 1 }]);
    expect(asShortfalls(undefined)).toEqual([]);
  });
});
