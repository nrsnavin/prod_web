import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DcForm } from "./DcForm";

// ══════════════════════════════════════════════════════════════════
//  A CHALLAN LINE HAS TO SAY WHICH ELASTIC IT IS
//
//  The elastic on a line used to be a free-text name. Everything
//  downstream keys on the ID: no id means no stock movement, no
//  reservation settled, and nothing against the order — so a row typed
//  by hand produced a challan that printed, shipped, and counted for
//  nothing anywhere. The Delivered column on the order read zero for
//  goods that had plainly gone.
//
//  It is a picker now. These hold the two halves of that:
//
//    • a line with no elastic chosen cannot be submitted
//    • choosing one carries its NAME across with its id, because the
//      name is what the printed challan shows
// ══════════════════════════════════════════════════════════════════

const onSubmit = vi.fn();

vi.mock("./hooks", () => ({
  useDcMutations: () => ({ create: { mutate: vi.fn(), isPending: false } }),
  useDcOrderInfo: () => ({ data: undefined }),
}));
vi.mock("@/features/orders/hooks", () => ({
  useOrders: () => ({ orders: [], total: 0 }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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

const renderForm = () =>
  render(
    <MemoryRouter>
      <DcForm onCancel={vi.fn()} onSubmit={onSubmit} submitting={false} />
    </MemoryRouter>
  );

beforeEach(() => onSubmit.mockClear());

describe("the elastic on a line", () => {
  it("is a picker, not a free-text name", () => {
    renderForm();
    expect(screen.getByLabelText(/^elastic$/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/elastic name/i)).not.toBeInTheDocument();
  });

  it("blocks submission when no elastic has been chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/customer name/i), "Ravi Textiles");
    await user.type(screen.getByLabelText(/^quantity$/i), "400");
    await user.click(screen.getByRole("button", { name: /create dc/i }));

    await waitFor(() =>
      expect(screen.getByText(/pick the elastic/i)).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits once an elastic is chosen, sending the id and the name", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/customer name/i), "Ravi Textiles");
    await user.type(screen.getByLabelText(/^quantity$/i), "400");

    await user.click(screen.getByLabelText(/^elastic$/i));
    await user.click(await screen.findByText("20mm Woven"));

    await user.click(screen.getByRole("button", { name: /create dc/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].items[0]).toMatchObject({
      elastic: "e1",
      // The name follows the id — the printed challan shows the name,
      // and a stale one would put a different product on the document
      // from the one whose stock moved.
      elasticName: "20mm Woven",
      quantity: 400,
    });
  });
});

describe("a machine-part challan", () => {
  it("keeps its free-text description — parts are not a master list", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText(/type/i), "machine_part");

    expect(screen.getByPlaceholderText(/part description/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^elastic$/i)).not.toBeInTheDocument();
  });
});
