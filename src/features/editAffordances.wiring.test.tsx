import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  CAN YOU ACTUALLY EDIT A PO, A CHALLAN, AN ORDER AND A JOB?
//
//  Each of those four has an edit form, and each was reported missing
//  from the running app. Component tests for the forms themselves pass,
//  which proves the forms work and proves nothing about whether anyone
//  can REACH them.
//
//  So these mock only the HTTP transport. The real api.ts, the real
//  hooks.ts and the real page all run, which means a button wired to
//  nothing, a modal imported but never rendered, or a mutation pointed
//  at a path the server does not serve all show up here.
//
//  For each of the four:
//
//    • the button is on the page when the record is in an editable state
//    • it is NOT there when the record is past editing — these gates are
//      the whole safety story, and a gate that never closes is as bad as
//      one that never opens
//    • clicking it opens the form
//    • saving reaches the endpoint the server actually serves
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const patch = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>(
    "@/core/http/httpClient"
  );
  return {
    ...actual,
    httpClient: {
      get:    (...a: unknown[]) => get(...a),
      post:   (...a: unknown[]) => post(...a),
      put:    (...a: unknown[]) => put(...a),
      delete: (...a: unknown[]) => del(...a),
      patch:  (...a: unknown[]) => patch(...a),
      getBlob: vi.fn(),
    },
  };
});

const toast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/ui/uiStore", () => ({ useTrackRecent: () => {} }));

// Heavy children that are not the subject here.
vi.mock("@/features/jobs/MachineAssignModal", () => ({ MachineAssignModal: () => null }));
vi.mock("@/features/jobs/QcPanel", () => ({ QcPanel: () => null }));
vi.mock("@/features/jobs/JobYarnLots", () => ({ JobYarnLots: () => null }));
vi.mock("@/features/jobs/OutsourcingPanel", () => ({ OutsourcingPanel: () => null }));
vi.mock("@/features/jobs/JobShiftSummary", () => ({ JobShiftSummary: () => null }));
vi.mock("@/features/orders/OrderAnalytics", () => ({ OrderAnalytics: () => null }));
vi.mock("@/features/orders/OrderDeliveryChallans", () => ({ OrderDeliveryChallans: () => null }));
vi.mock("@/features/orders/OrderSuggestedPlan", () => ({ OrderSuggestedPlan: () => null }));
vi.mock("@/features/orders/OrderYarnLots", () => ({ OrderYarnLots: () => null }));
vi.mock("@/features/orders/OrderMaterialPo", () => ({ OrderMaterialPo: () => null }));
vi.mock("@/components/print/PrintModal", () => ({ PrintModal: () => null }));

import { PoDetailPage } from "@/features/suppliers/PoDetailPage";
import { DcDetailPage } from "@/features/deliveryChallans/DcDetailPage";
import { OrderDetailPage } from "@/features/orders/OrderDetailPage";
import { JobDetailPage } from "@/features/jobs/JobDetailPage";

const renderAt = (path: string, route: string, El: React.ComponentType) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={<El />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const editButton = () => screen.queryByRole("button", { name: /^edit$/i });

beforeEach(() => {
  [get, post, put, del, patch, toast].forEach((m) => m.mockReset());
  get.mockResolvedValue({ success: true });
});

// ══════════════════════════════════════════════════════════════════
describe("purchase order", () => {
  const po = (over = {}) => ({
    _id: "po1", poNo: 7, status: "Open", __v: 0,
    supplier: { _id: "s1", name: "Yarn Co" },
    items: [{ rawMaterial: { _id: "m1", name: "Nylon 40D" }, quantity: 100, price: 20, receivedQuantity: 0 }],
    ...over,
  });

  const show = (over = {}) => {
    get.mockImplementation((url: string) => {
      if (String(url).includes("/supplier/get-po")) {
        return Promise.resolve({ success: true, po: po(over) });
      }
      return Promise.resolve({ success: true, rawMaterials: [], materials: [] });
    });
    return renderAt("/purchase-orders/po1", "/purchase-orders/:id", PoDetailPage);
  };

  it("offers Edit on an Open PO with nothing received", async () => {
    show();
    await waitFor(() => expect(editButton()).toBeInTheDocument());
  });

  it("withdraws Edit once goods have been received against it", async () => {
    show({
      items: [{ rawMaterial: { _id: "m1", name: "Nylon 40D" }, quantity: 100, price: 20, receivedQuantity: 40 }],
    });
    await screen.findByText(/Nylon 40D/);
    expect(editButton()).not.toBeInTheDocument();
  });

  it("withdraws Edit once the PO is no longer Open", async () => {
    show({ status: "Completed" });
    await screen.findByText(/Nylon 40D/);
    expect(editButton()).not.toBeInTheDocument();
  });

  it("opens the form and saves to /supplier/edit-po", async () => {
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(editButton()).toBeInTheDocument());
    await user.click(editButton()!);

    expect(await screen.findByText(/edit purchase order/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/why is this being changed/i),
      "Supplier revised the rate"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).toBe("/supplier/edit-po");
  });
});

// ══════════════════════════════════════════════════════════════════
describe("delivery challan", () => {
  const dc = (over = {}) => ({
    _id: "dc1", dcNumber: "DC/25-26/0007", type: "elastic", status: "draft",
    customerName: "Ravi Textiles", totalQuantity: 500,
    items: [{ _id: "i1", elastic: { _id: "e1", name: "20mm Woven" }, elasticName: "20mm Woven", quantity: 500, rate: 12 }],
    ...over,
  });

  const show = (over = {}) => {
    get.mockImplementation((url: string) => {
      if (String(url).includes("/dc/detail")) {
        return Promise.resolve({ success: true, dc: dc(over) });
      }
      return Promise.resolve({ success: true, elastics: [] });
    });
    return renderAt("/delivery-challans/dc1", "/delivery-challans/:id", DcDetailPage);
  };

  it("offers Edit on a draft challan", async () => {
    show();
    await waitFor(() => expect(editButton()).toBeInTheDocument());
  });

  it("offers Edit on a dispatched one — it can still be corrected", async () => {
    show({ status: "dispatched" });
    await waitFor(() => expect(editButton()).toBeInTheDocument());
  });

  it("withdraws Edit once delivered — the customer holds it as their receipt", async () => {
    show({ status: "delivered" });
    // The customer name appears in the header and again on the printed
    // challan body, so anchor on the status chip instead.
    await screen.findByText("delivered");
    expect(editButton()).not.toBeInTheDocument();
  });

  it("withdraws Edit once cancelled — its stock has already gone back", async () => {
    show({ status: "cancelled" });
    await screen.findAllByText("cancelled");
    expect(editButton()).not.toBeInTheDocument();
  });

  it("opens the form and saves to /dc/update", async () => {
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(editButton()).toBeInTheDocument());
    await user.click(editButton()!);

    expect(await screen.findByText(/edit dc\/25-26\/0007/i)).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/why is this being changed/i),
      "Lorry number was wrong"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][0]).toBe("/dc/update");
  });
});

// ══════════════════════════════════════════════════════════════════
describe("order", () => {
  const order = (over = {}) => ({
    _id: "o1", orderNo: 1042, status: "Open", __v: 3,
    po: "PO-9", date: "2026-01-01", supplyDate: "2026-02-01",
    customer: { _id: "c1", name: "Ravi Textiles" },
    elastics: [{
      id: "e1", name: "20mm Woven", ordered: 1000, produced: 0, packed: 0,
      delivered: 0, undelivered: 1000, notAssigned: 1000, pendingDelivery: 1000,
      pending: 1000, reserved: 0,
    }],
    jobs: [], rawMaterialRequired: [], fingerprints: [],
    ...over,
  });

  const show = (over = {}) => {
    get.mockImplementation((url: string) => {
      if (String(url).includes("/order/get-orderDetail")) {
        return Promise.resolve({ success: true, data: order(over) });
      }
      return Promise.resolve({ success: true, data: [], elastics: [] });
    });
    return renderAt("/orders/o1", "/orders/:id", OrderDetailPage);
  };

  it("offers Edit while the order is still Open", async () => {
    show();
    await waitFor(() => expect(editButton()).toBeInTheDocument());
  });

  it("withdraws Edit once approved — jobs and yarn hang off these figures", async () => {
    show({ status: "Approved" });
    await screen.findByText(/20mm Woven/);
    expect(editButton()).not.toBeInTheDocument();
  });

  it("opens the form with the elastic lines editable", async () => {
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(editButton()).toBeInTheDocument());
    await user.click(editButton()!);

    expect(await screen.findByText(/edit order/i)).toBeInTheDocument();
    // The quantity field is the point of the whole feature.
    expect(screen.getByLabelText("Quantity for 20mm Woven")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════
describe("job", () => {
  const job = (over = {}) => ({
    id: "j1", jobOrderNo: 12, jobNo: "J-12", status: "preparatory",
    customerName: "Sri Textiles", orderNo: 1042,
    plannedElastics: [{ elasticId: "e1", elasticName: "20mm Woven", quantity: 500 }],
    producedElastics: [], packedElastics: [], wastageElastics: [],
    shiftDetails: [], wastages: [], packingDetails: [],
    warping: { status: "open" }, covering: { status: "open" },
    ...over,
  });

  const show = (over = {}) => {
    get.mockImplementation((url: string) => {
      if (String(url).includes("weaving-readiness")) {
        return Promise.resolve({ success: true, data: { ready: true, stages: [], blockers: [] } });
      }
      return Promise.resolve({ success: true, data: job(over) });
    });
    return renderAt("/jobs/j1", "/jobs/:id", JobDetailPage);
  };

  const qtyButton = () => screen.queryByRole("button", { name: /edit quantities/i });

  it("offers Edit quantities while preparatory with both programmes open", async () => {
    show();
    await waitFor(() => expect(qtyButton()).toBeEnabled());
  });

  it("disables it once warping has started", async () => {
    show({ warping: { status: "completed" } });
    await waitFor(() => expect(qtyButton()).toBeDisabled());
  });

  it("withdraws it entirely once the job is weaving", async () => {
    show({ status: "weaving" });
    await screen.findByText(/Sri Textiles/);
    expect(qtyButton()).not.toBeInTheDocument();
  });

  it("opens the form and saves to /job/update-elastics", async () => {
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(qtyButton()).toBeEnabled());
    await user.click(qtyButton()!);

    const qty = await screen.findByLabelText(/planned quantity for 20mm woven/i);
    await user.clear(qty);
    await user.type(qty, "300");
    await user.type(
      screen.getByPlaceholderText(/why is this being changed/i),
      "Customer cut the order"
    );
    await user.click(screen.getByRole("button", { name: /save quantities/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const call = post.mock.calls.find((c) => String(c[0]).includes("update-elastics"));
    expect(call?.[0]).toBe("/job/update-elastics");
    expect(call?.[1]).toMatchObject({
      jobId: "j1",
      elastics: [{ elastic: "e1", quantity: 300 }],
    });
  });
});
