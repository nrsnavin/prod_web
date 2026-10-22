import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JobChangeElasticModal } from "./JobChangeElasticModal";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  CHANGING THE ELASTIC ON A RUNNING JOB
//
//  Only the order's elastics not yet on the job are offered, with what
//  the order still has unplanned; the line the loom is on starts ticked
//  to be frozen at what was woven; nothing goes without a reason.
// ══════════════════════════════════════════════════════════════════

const mutate = vi.fn();
const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./hooks", () => ({
  useJobMutations: () => ({ changeElastic: { mutate, isPending: false } }),
  useJobOrderElastics: () => ({
    isLoading: false,
    data: {
      orderNo: 41,
      elastics: [
        { elasticId: "a", elasticName: "20mm White", ordered: 5000, planned: 5000, pending: 0, onJob: true, frozen: false },
        { elasticId: "b", elasticName: "25mm Black", ordered: 3000, planned: 0, pending: 3000, onJob: false, frozen: false },
        { elasticId: "c", elasticName: "30mm Navy", ordered: 1000, planned: 1000, pending: 0, onJob: false, frozen: false },
      ],
    },
  }),
}));

const job = (): JobDetail =>
  ({
    id: "j1", __v: 4, jobOrderNo: 12, jobNo: "J-12", status: "weaving", customerName: "Acme",
    plannedElastics: [{ elasticId: "a", elasticName: "20mm White", quantity: 5000 }],
    producedElastics: [{ elasticId: "a", elasticName: "20mm White", quantity: 3200 }],
    packedElastics: [], wastageElastics: [], shiftDetails: [], wastages: [], packingDetails: [],
    machine: { machineId: "m1", machineName: "M-7", machineNoOfHead: 2 },
  }) as unknown as JobDetail;

const renderModal = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <JobChangeElasticModal job={job()} open onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => { mutate.mockClear(); toast.mockClear(); });

describe("the mid-run change dialog", () => {
  it("offers only the order's elastics not on the job, with what is unplanned", () => {
    renderModal();
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.some((t) => t?.startsWith("25mm Black · 3,000 m not yet planned"))).toBe(true);
    expect(options.some((t) => t?.startsWith("30mm Navy"))).toBe(true);
    expect(options.some((t) => t?.startsWith("20mm White"))).toBe(false);
  });

  it("the line the loom is on starts ticked to be frozen at what was woven", () => {
    renderModal();
    expect(screen.getByRole("checkbox", { name: "Freeze 20mm White" })).toBeChecked();
    expect(screen.getByText(/frozen at 3,200 m, 1,800 m back to the order/)).toBeInTheDocument();
  });

  it("sends the elastic, the quantity (the unplanned amount by default), the freeze and the reason", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.selectOptions(screen.getByLabelText(/Elastic to put on/), "b");
    expect(screen.getByLabelText(/Quantity to plan/)).toHaveValue(3000);
    const button = screen.getByRole("button", { name: /^change elastic$/i });
    expect(button).toBeDisabled(); // no reason yet
    await user.type(screen.getByLabelText("Reason for the change"), "Beam came up short of the programme");
    await user.click(button);
    expect(mutate.mock.calls[0][0]).toEqual({
      jobId: "j1",
      body: {
        elastic: "b", quantity: 3000, auditReason: "Beam came up short of the programme",
        freeze: ["a"], heads: "frozen", confirmHooks: false, expectedVersion: 4,
      },
    });
  });

  it("will not plan more than the order has unplanned", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.selectOptions(screen.getByLabelText(/Elastic to put on/), "b");
    const qty = screen.getByLabelText(/Quantity to plan/);
    await user.clear(qty);
    await user.type(qty, "3500");
    await user.type(screen.getByLabelText("Reason for the change"), "Beam came up short of the programme");
    expect(screen.getAllByText(/only 3,000 m of it not yet planned|At most 3,000 m/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^change elastic$/i })).toBeDisabled();
  });
});

describe("nothing coming in", () => {
  it("just freezes the ticked lines, freeing their heads", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.selectOptions(screen.getByLabelText(/Elastic to put on/), "__none__");
    expect(screen.queryByLabelText(/Quantity to plan/)).not.toBeInTheDocument();
    expect(screen.getByText("Free the heads the frozen elastic is on")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reason for the change"), "Beam ran out; nothing else for this loom");
    await user.click(screen.getByRole("button", { name: /^freeze$/i }));
    expect(mutate.mock.calls[0][0].body).toMatchObject({ elastic: null, quantity: 0, freeze: ["a"], heads: "frozen" });
  });
});
