import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LotCoverage, OrderLotAssign } from "./OrderLotAssign";
import type { OrderDetail, RawMaterialRequirement } from "./types";

// ═══════════════════════════════════════════════════════════════════
//  Setting dye lots aside on an order.
//
//  An earmark says which bags this order's draw is expected to come
//  out of. It moves nothing on the lot — the yarn is still on the rack
//  and leaves when a warping batch draws it — so what the panel has to
//  get right is:
//
//    • partial coverage reads as normal, not as an unfinished form;
//    • the button is only offered while the order can actually hold
//      yarn, because the server refuses it otherwise;
//    • the lots already set aside are visible without opening anything.
// ═══════════════════════════════════════════════════════════════════

// Shaped to match the real ToastApi — { toast, dismissAll } — not a
// convenient invention. A mock that answers to a method the component
// does not call is a mock that hides a broken call site: the first
// version of this returned { show }, the component called .show, and
// both were wrong together while the tests stayed green.
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn(), dismissAll: vi.fn() }),
}));

const material = (over: Partial<RawMaterialRequirement> = {}): RawMaterialRequirement => ({
  rawMaterial: "M1",
  name: "Nylon 40D",
  requiredWeight: 400,
  ...over,
});

const order = (over: Partial<OrderDetail> = {}): OrderDetail =>
  ({
    _id: "O1",
    orderNo: 1042,
    status: "Approved",
    rawMaterialRequired: [material()],
    ...over,
  }) as OrderDetail;

const renderPanel = (o: OrderDetail) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OrderLotAssign order={o} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => vi.clearAllMocks());

describe("coverage", () => {
  it("says nothing is set aside when nothing is", () => {
    render(<LotCoverage material={material({ lots: [] })} />);
    expect(screen.getByText(/no lots set aside/i)).toBeInTheDocument();
  });

  it("reports a partial assignment as a quantity, not as an error", () => {
    render(
      <LotCoverage
        material={material({
          requiredWeight: 400,
          lots: [{ yarnLot: "L1", lotNo: "D-1", quantity: 250 }],
        })}
      />
    );
    expect(screen.getByText(/250 kg of 400 kg/i)).toBeInTheDocument();
  });

  it("calls it fully set aside when the earmarks cover the requirement", () => {
    render(
      <LotCoverage
        material={material({
          requiredWeight: 400,
          lots: [
            { yarnLot: "L1", lotNo: "D-1", quantity: 150 },
            { yarnLot: "L2", lotNo: "D-2", quantity: 250 },
          ],
        })}
      />
    );
    expect(screen.getByText(/fully set aside/i)).toBeInTheDocument();
  });

  it("does not report a rounding artefact as an uncovered kilo", () => {
    // Three lots of 0.15 against a 0.45 requirement. In IEEE floats
    // that sum is 0.44999999999999996, so a raw `>=` reports the order
    // as short by a quantity no scale on the floor can weigh — and
    // full coverage becomes unreachable for any requirement that
    // divides badly. The numbers are small on purpose: this is the
    // exact triple that fails without the rounding, verified rather
    // than assumed.
    expect(0.15 * 3 >= 0.45).toBe(false);

    render(
      <LotCoverage
        material={material({
          requiredWeight: 0.45,
          lots: [
            { yarnLot: "L1", lotNo: "D-1", quantity: 0.15 },
            { yarnLot: "L2", lotNo: "D-2", quantity: 0.15 },
            { yarnLot: "L3", lotNo: "D-3", quantity: 0.15 },
          ],
        })}
      />
    );
    expect(screen.getByText(/fully set aside/i)).toBeInTheDocument();
  });
});

describe("the panel", () => {
  it("lists the lots already set aside without opening anything", () => {
    renderPanel(
      order({
        rawMaterialRequired: [
          material({ lots: [{ yarnLot: "L1", lotNo: "D-4471", quantity: 250 }] }),
        ],
      })
    );
    // The number and the lot must be in the SAME element. "250 kg"
    // also appears in the coverage chip, so a loose page-wide query
    // would pass with the lot row showing no quantity at all.
    const lot = screen.getByText("D-4471");
    expect(lot.parentElement?.textContent).toMatch(/D-4471\s*250 kg/);
  });

  it("says plainly when a material has nothing set aside", () => {
    renderPanel(order());
    expect(screen.getByText(/nothing set aside/i)).toBeInTheDocument();
  });

  it("offers the assign button on an approved order", () => {
    renderPanel(order({ status: "Approved" }));
    expect(screen.getByRole("button", { name: /assign/i })).toBeEnabled();
  });

  it("offers it on an in-progress order too", () => {
    renderPanel(order({ status: "InProgress" }));
    expect(screen.getByRole("button", { name: /assign/i })).toBeEnabled();
  });

  it.each(["Open", "Completed", "Cancelled"])(
    "disables it on a %s order rather than letting the server refuse",
    (status) => {
      renderPanel(order({ status: status as OrderDetail["status"] }));
      expect(screen.getByRole("button", { name: /assign/i })).toBeDisabled();
    }
  );

  it("says why it is disabled instead of leaving a dead button", () => {
    renderPanel(order({ status: "Completed" }));
    const btn = screen.getByRole("button", { name: /assign/i });
    expect(btn.getAttribute("title")).toMatch(/approved or in progress/i);
  });

  it("says Change rather than Assign once lots are set", () => {
    renderPanel(
      order({
        rawMaterialRequired: [
          material({ lots: [{ yarnLot: "L1", lotNo: "D-1", quantity: 100 }] }),
        ],
      })
    );
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
  });

  it("renders nothing for an order with no material requirement", () => {
    const { container } = renderPanel(order({ rawMaterialRequired: [] }));
    expect(container).toBeEmptyDOMElement();
  });

  it("explains that setting aside is not taking off the rack", () => {
    // The single most misreadable thing about this feature. If the copy
    // stops saying it, somebody will read the panel as a stock movement.
    renderPanel(order());
    expect(screen.getByText(/nothing leaves the rack/i)).toBeInTheDocument();
  });
});
