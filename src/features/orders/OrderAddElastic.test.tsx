import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/core/http/httpClient";
import { OrderAddElasticModal } from "./OrderAddElasticModal";
import { OrderAmendments } from "./OrderAmendments";
import type { OrderDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  ADDING AN ELASTIC TO AN APPROVED ORDER
//
//  The reason is required, the elastics already on the order are not
//  offered, and a shortfall turns into the force prompt rather than a
//  toast — the same prompt approval uses.
// ══════════════════════════════════════════════════════════════════

const mutate = vi.fn();
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./hooks", () => ({ useOrderMutations: () => ({ addElastic: { mutate, isPending: false } }) }));
vi.mock("@/features/elastics/api", () => ({
  elasticService: {
    list: vi.fn().mockResolvedValue({
      elastics: [{ _id: "a", name: "20mm White" }, { _id: "b", name: "25mm Black" }],
    }),
  },
}));

const order = (): OrderDetail =>
  ({
    _id: "o1", __v: 3, orderNo: 41, status: "Approved",
    elastics: [{ id: "a", name: "20mm White", ordered: 5000, produced: 0, packed: 0, delivered: 0, undelivered: 5000, notAssigned: 5000, pendingDelivery: 5000, pending: 5000, reserved: 5000 }],
    jobs: [], rawMaterialRequired: [], excessPlanning: [], amendments: [],
  }) as unknown as OrderDetail;

const renderModal = () => render(<OrderAddElasticModal order={order()} open onClose={vi.fn()} />);

beforeEach(() => { mutate.mockClear(); toast.mockClear(); });

describe("the add-elastic dialog", () => {
  it("offers only elastics not on the order, and sends the line with the reason and version", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: /search elastics/i }));
    expect(await screen.findByRole("option", { name: "25mm Black" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "20mm White" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "25mm Black" }));
    await user.type(screen.getByLabelText(/Quantity \(m\)/), "1000");
    await user.type(screen.getByLabelText(/Rate/), "15");
    const button = screen.getByRole("button", { name: /^add elastic$/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Reason for adding"), "Customer added it to the PO");
    await user.click(button);
    expect(mutate.mock.calls[0][0]).toEqual({
      id: "o1",
      body: { elastic: "b", quantity: 1000, rate: 15, auditReason: "Customer added it to the PO", expectedVersion: 3 },
    });
  });

  it("a shortfall opens the force prompt, and confirming re-sends with force and its reason", async () => {
    const user = userEvent.setup();
    mutate.mockImplementationOnce((_v: unknown, opts?: { onError?: (e: unknown) => void }) =>
      opts?.onError?.(Object.assign(new ApiError("Insufficient stock for Poly 300D (have 0.2, need 0.5)", 400), {
        code: "INSUFFICIENT_STOCK",
        data: { shortfall: { materialId: "m", materialName: "Poly 300D", available: 0.2, required: 0.5, short: 0.3 } },
      }))
    );
    renderModal();
    await user.click(screen.getByRole("button", { name: /search elastics/i }));
    await user.click(await screen.findByRole("option", { name: "25mm Black" }));
    await user.type(screen.getByLabelText(/Quantity \(m\)/), "1000");
    await user.type(screen.getByLabelText("Reason for adding"), "Customer added it to the PO");
    await user.click(screen.getByRole("button", { name: /^add elastic$/i }));

    expect((await screen.findAllByText(/Poly 300D/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Short 0\.30? kg/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reason for approving anyway"), "Yarn arrives tomorrow");
    await user.click(screen.getByRole("button", { name: /force|approve anyway|confirm/i }));
    expect(mutate.mock.calls[1][0].body).toMatchObject({ force: true, forceReason: "Yarn arrives tomorrow" });
  });
});

describe("the amendments card", () => {
  it("names each elastic, its yarn, and a forced draw's shortfall", () => {
    render(
      <OrderAmendments
        rows={[{
          elastic: "b", name: "25mm Black", quantity: 1000, rate: 15, reason: "Customer added it", forced: true,
          forceReason: "Yarn arrives tomorrow",
          shortfalls: [{ rawMaterial: "m", name: "Poly 300D", required: 0.5, available: 0.2, short: 0.3 }],
          materialsDrawn: [{ rawMaterial: "m", name: "Poly 300D", requested: 0.5, applied: 0.2 }],
          recordedAt: "2026-10-22T05:00:00Z",
        }]}
      />
    );
    expect(screen.getByText("Added after approval")).toBeInTheDocument();
    expect(screen.getByText("25mm Black")).toBeInTheDocument();
    expect(screen.getByText(/Poly 300D: 0.2 kg/)).toBeInTheDocument();
    expect(screen.getByText(/of 0.5 — short 0.3/)).toBeInTheDocument();
    expect(screen.getByText("Forced")).toBeInTheDocument();
  });

  it("is absent when nothing was added", () => {
    const { container } = render(<OrderAmendments rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
