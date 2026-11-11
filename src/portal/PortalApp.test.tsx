import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { Gate, makePortalClient } from "./PortalApp";
import { PortalError, type Me, type OrderDetail, type Summary } from "./api";
import { yearSoFar } from "./pages/StatementPage";

// The customer portal: signing in, what each role is shown, an order and
// its certificates, and a session that ends part-way.

const api = vi.hoisted(() => ({
  me: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), summary: vi.fn(), orders: vi.fn(), order: vi.fn(),
  orderCertificates: vi.fn(), dispatches: vi.fn(), dispatch: vi.fn(), dispatchCertificates: vi.fn(),
  invoices: vi.fn(), statement: vi.fn(),
}));
vi.mock("./api", async (importActual) => ({
  ...(await importActual<typeof import("./api")>()),
  portal: api,
}));

const buyer: Me = { user: { _id: "u1", name: "Priya", email: "priya@acme.test", role: "buyer" }, customer: { _id: "c1", name: "Acme Garments" } };
const summary: Summary = {
  company: { name: "Balu Elastics", phone: "0421 222 333" },
  customer: { name: "Acme Garments" },
  user: { name: "Priya", role: "buyer" },
  orders: { open: 2, dueSoon: 1 },
  lastDispatch: { id: "d1", dcNumber: "DC/2026/0001", date: "2026-07-11" },
  canSeeMoney: true,
  money: { owed: 6500, overdue: 0, invoices: 1 },
};
const order: OrderDetail = {
  id: "o1", orderNo: 118, po: "PO-77", date: "2026-07-01", supplyDate: "2026-07-20", stage: "in_production",
  lines: [
    { elastic: "e1", name: "20mm", ordered: 1000, produced: 800, dispatched: 300, toCome: 700 },
    { elastic: "e2", name: "25mm", ordered: 500, produced: 0, dispatched: 0, toCome: 500 },
  ],
  totals: { ordered: 1500, produced: 800, dispatched: 300, toCome: 1200 },
  dispatches: [{ id: "d1", dcNumber: "DC/2026/0001", date: "2026-07-11", status: "dispatched", deliveredOn: null, order: null, quantity: 300, items: [] }],
  hasCertificates: true,
};

const open = (path = "/") =>
  render(
    <QueryClientProvider client={makePortalClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Gate />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.summary.mockResolvedValue(summary);
  api.orders.mockResolvedValue({ total: 0, page: 1, pages: 1, orders: [] });
  api.dispatches.mockResolvedValue({ total: 0, page: 1, pages: 1, dispatches: [] });
});

describe("signing in", () => {
  it("asks a signed-out visitor to sign in, then shows their own home", async () => {
    api.me.mockRejectedValueOnce(new PortalError("Please log in to the portal", 401)).mockResolvedValue(buyer);
    api.signIn.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    open();
    const form = await screen.findByRole("form", { name: "Sign in" });
    await user.type(within(form).getByLabelText("Email"), " priya@acme.test ");
    await user.type(within(form).getByLabelText("Password"), "cotton-reel-7");
    await user.click(within(form).getByRole("button", { name: "Sign in" }));
    expect(api.signIn).toHaveBeenCalledWith("priya@acme.test", "cotton-reel-7");
    expect(await screen.findByRole("heading", { name: "Acme Garments" })).toBeInTheDocument();
    expect(screen.getByText("1 due within two weeks")).toBeInTheDocument();
    expect(screen.getByText("₹6,500")).toBeInTheDocument();
  });

  it("says what was wrong when the sign-in is refused", async () => {
    api.me.mockRejectedValue(new PortalError("Please log in to the portal", 401));
    api.signIn.mockRejectedValue(new PortalError("Invalid email or password", 401));
    const user = userEvent.setup();
    open();
    const form = await screen.findByRole("form", { name: "Sign in" });
    await user.type(within(form).getByLabelText("Email"), "priya@acme.test");
    await user.type(within(form).getByLabelText("Password"), "wrong-one-1");
    await user.click(within(form).getByRole("button", { name: "Sign in" }));
    expect(await within(form).findByText("Invalid email or password")).toBeInTheDocument();
  });
});

describe("what each login is shown", () => {
  it("a buyer has invoices and the statement", async () => {
    api.me.mockResolvedValue(buyer);
    open();
    const nav = await screen.findByRole("navigation", { name: "Portal" });
    expect(within(nav).getByRole("button", { name: /Invoices/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Statement/ })).toBeInTheDocument();
  });

  it("a viewer has neither, and no money on the home page", async () => {
    api.me.mockResolvedValue({ ...buyer, user: { ...buyer.user, role: "viewer" } });
    api.summary.mockResolvedValue({ ...summary, canSeeMoney: false, money: undefined });
    open();
    const nav = await screen.findByRole("navigation", { name: "Portal" });
    expect(within(nav).queryByRole("button", { name: /Invoices/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: /Statement/ })).not.toBeInTheDocument();
    expect((await screen.findAllByText("Open orders")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Owed")).not.toBeInTheDocument();
  });
});

describe("an order", () => {
  it("shows each elastic ordered, woven, dispatched and still to come, and where it stands", async () => {
    api.me.mockResolvedValue(buyer);
    api.order.mockResolvedValue(order);
    open("/orders/o1");
    expect(await screen.findByRole("heading", { name: "Order #118" })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /20mm/ });
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(
      expect.arrayContaining(["1,000 m", "800 m", "300 m", "700 m"]),
    );
    // The phone's cards and the wider screen's table are both in the page; CSS shows one.
    for (const bar of screen.getAllByRole("progressbar", { name: "20mm dispatched" })) expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(screen.getByText("Where the order stands")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Test certificates/ })).toHaveAttribute("href", "/orders/o1/certificates");
    expect(screen.getByRole("link", { name: /Challan/ }).getAttribute("href")).toMatch(/\/dispatches\/d1\/pdf$/);
  });

  it("one that is not the customer's reads as not here", async () => {
    api.me.mockResolvedValue(buyer);
    api.order.mockRejectedValue(new PortalError("Order not found", 404));
    open("/orders/other");
    expect(await screen.findByRole("heading", { name: "That order is not here" })).toBeInTheDocument();
  });

  it("its certificates list each test with what was specified, measured and the result", async () => {
    api.me.mockResolvedValue(buyer);
    api.orderCertificates.mockResolvedValue({
      order: { id: "o1", orderNo: 118, po: "PO-77" },
      certificates: [{ elastic: "e1", name: "20mm", job: "J-41", checkedAt: "2026-07-08", checkedBy: "Kavya", results: [{ parameter: "Width", expected: "20 mm", measured: "20.1 mm", pass: true }] }],
    });
    open("/orders/o1/certificates");
    expect(await screen.findByRole("heading", { name: "20mm" })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Width/ });
    expect(row).toHaveTextContent("20 mm");
    expect(row).toHaveTextContent("20.1 mm");
    expect(row).toHaveTextContent("Pass");
    expect(screen.getByRole("button", { name: /Print/ })).toBeInTheDocument();
  });
});

describe("a session that ends part-way", () => {
  it("goes back to the sign-in page", async () => {
    api.me.mockResolvedValueOnce(buyer).mockRejectedValue(new PortalError("Portal session has ended", 401));
    api.order.mockRejectedValue(new PortalError("Portal session has ended", 401));
    open("/orders/o1");
    expect(await screen.findByRole("form", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("the statement's dates", () => {
  it("default to the financial year so far", () => {
    expect(yearSoFar(new Date(2026, 10, 11))).toEqual({ from: "2026-04-01", to: "2026-11-11" });
    expect(yearSoFar(new Date(2027, 1, 3))).toEqual({ from: "2026-04-01", to: "2027-02-03" });
  });
});
