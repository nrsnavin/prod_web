import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DcForm } from "./DcForm";
import { DcEditModal, boxesChanged, linesChanged, linesFromDc } from "./DcEditModal";
import type { DeliveryChallan } from "./types";

// ══════════════════════════════════════════════════════════════════
//  BOXES ON A CHALLAN
//
//  Each line says how many boxes it went out in, and the challan adds
//  them up. The invoice raised against the challan takes its boxes from
//  here, so they are typed once, where the goods are packed.
//
//    • the create form sends each line's boxes and shows the total
//    • blank boxes are none, not an error; part boxes are refused
//    • on an edit, a recount of boxes alone is sent without being taken
//      for a change of goods, so no stock moves for it
// ══════════════════════════════════════════════════════════════════

const onSubmit = vi.fn();
const updateMutate = vi.fn();

vi.mock("./hooks", () => ({
  useDcMutations: () => ({ create: { mutate: vi.fn(), isPending: false }, update: { mutate: updateMutate, isPending: false } }),
  useDcOrderInfo: () => ({ data: undefined }),
}));
vi.mock("@/features/orders/hooks", () => ({ useOrders: () => ({ orders: [], total: 0 }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/elastics/api", () => ({
  elasticService: {
    list: vi.fn().mockResolvedValue({ elastics: [{ _id: "e1", name: "20mm Woven" }, { _id: "e2", name: "32mm Knitted" }] }),
  },
}));

beforeEach(() => {
  onSubmit.mockClear();
  updateMutate.mockClear();
});

const renderForm = () =>
  render(
    <MemoryRouter>
      <DcForm onCancel={vi.fn()} onSubmit={onSubmit} submitting={false} />
    </MemoryRouter>
  );

async function pickElastic(user: ReturnType<typeof userEvent.setup>, index: number, name: string) {
  await user.click(screen.getAllByLabelText(/^elastic$/i)[index]);
  await user.click(await screen.findByText(name));
}

describe("the create form", () => {
  it("sends each line's boxes and adds them up on screen", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/customer name/i), "Ravi Textiles");

    await pickElastic(user, 0, "20mm Woven");
    await user.type(screen.getAllByLabelText(/^quantity$/i)[0], "4000");
    await user.type(screen.getAllByLabelText(/^boxes$/i)[0], "16");

    await user.click(screen.getByRole("button", { name: /add item/i }));
    await pickElastic(user, 1, "32mm Knitted");
    await user.type(screen.getAllByLabelText(/^quantity$/i)[1], "1000");
    await user.type(screen.getAllByLabelText(/^boxes$/i)[1], "4");

    expect(screen.getByTestId("dc-total-boxes")).toHaveTextContent("20");

    await user.click(screen.getByRole("button", { name: /create dc/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const items = onSubmit.mock.calls[0][0].items;
    expect(items[0]).toMatchObject({ elastic: "e1", quantity: 4000, boxes: 16 });
    expect(items[1]).toMatchObject({ elastic: "e2", quantity: 1000, boxes: 4 });
  });

  it("takes blank boxes as none", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/customer name/i), "Ravi Textiles");
    await pickElastic(user, 0, "20mm Woven");
    await user.type(screen.getByLabelText(/^quantity$/i), "400");
    await user.click(screen.getByRole("button", { name: /create dc/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].items[0].boxes).toBe(0);
  });

  it("refuses part of a box", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText(/customer name/i), "Ravi Textiles");
    await pickElastic(user, 0, "20mm Woven");
    await user.type(screen.getByLabelText(/^quantity$/i), "400");
    await user.type(screen.getByLabelText(/^boxes$/i), "2.5");
    await user.click(screen.getByRole("button", { name: /create dc/i }));
    await waitFor(() => expect(screen.getByText(/whole boxes/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

const dc: DeliveryChallan = {
  _id: "dc1",
  __v: 2,
  dcNumber: "E-26/27-0007",
  type: "elastic",
  status: "dispatched",
  customerName: "Sunrise Garments",
  items: [{ elastic: { _id: "e1", name: "20mm Woven" }, elasticName: "20mm Woven", unit: "m", quantity: 500, rate: 4, boxes: 5 }],
  totalQuantity: 500,
  totalBoxes: 5,
};

describe("the edit form", () => {
  it("loads the boxes, and a recount alone is not a change of goods", () => {
    const base = linesFromDc(dc);
    expect(base[0].boxes).toBe("5");
    const recount = [{ ...base[0], boxes: "6" }];
    expect(linesChanged(base, recount)).toBe(false);
    expect(boxesChanged(base, recount)).toBe(true);
    expect(boxesChanged(base, linesFromDc(dc))).toBe(false);
  });

  it("sends the recounted boxes without warning that stock will move", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DcEditModal dc={dc} open onClose={vi.fn()} />
      </MemoryRouter>
    );
    const boxes = screen.getByLabelText(/^boxes$/i);
    await user.clear(boxes);
    await user.type(boxes, "6");
    expect(screen.queryByText(/stock will move/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("dc-total-boxes")).toHaveTextContent("6");

    await user.type(screen.getByLabelText(/reason for this change/i), "Recounted at the gate");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const body = updateMutate.mock.calls[0][0];
    expect(body.items).toEqual([expect.objectContaining({ elastic: "e1", quantity: 500, boxes: 6, unit: "m" })]);
  });
});
