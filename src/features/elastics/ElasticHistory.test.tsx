import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ElasticHistory } from "./ElasticHistory";
import type { ElasticJobRow, ElasticOrderRow } from "./types";

// ══════════════════════════════════════════════════════════════════
//  Two lists that answer "who buys this and when did we last run it".
//
//  The thing worth guarding is the paging: both panels are on one
//  screen, and a shared page number would step them together. So the
//  page each panel asks for is asserted, not just the rows it renders.
// ══════════════════════════════════════════════════════════════════

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

let orderPage = { orders: [] as ElasticOrderRow[], page: 1, limit: 10, total: 0, hasMore: false };
let jobPage = { jobs: [] as ElasticJobRow[], page: 1, limit: 10, total: 0, hasMore: false };
const ordersAsked: number[] = [];
const jobsAsked: number[] = [];

vi.mock("./hooks", () => ({
  useElasticOrders: (_id: string, page: number) => {
    ordersAsked.push(page);
    return { data: orderPage, isLoading: false };
  },
  useElasticJobs: (_id: string, page: number) => {
    jobsAsked.push(page);
    return { data: jobPage, isLoading: false };
  },
}));

const order = (over: Partial<ElasticOrderRow> = {}): ElasticOrderRow => ({
  id: "o1",
  orderNo: 1042,
  po: "PO-77",
  date: "2026-06-01T00:00:00.000Z",
  supplyDate: "2026-07-01T00:00:00.000Z",
  status: "InProgress",
  customerId: "c1",
  customerName: "Acme Garments",
  ordered: 1000,
  produced: 400,
  packed: 350,
  ...over,
});

const job = (over: Partial<ElasticJobRow> = {}): ElasticJobRow => ({
  id: "j1",
  jobOrderNo: 12,
  jobNo: "J-12",
  date: "2026-06-05T00:00:00.000Z",
  status: "weaving",
  orderId: "o1",
  orderNo: 1042,
  customerName: "Acme Garments",
  planned: 400,
  produced: 380,
  packed: 350,
  wastage: 20,
  ...over,
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <ElasticHistory elasticId="e1" />
    </MemoryRouter>
  );

beforeEach(() => {
  navigate.mockClear();
  ordersAsked.length = 0;
  jobsAsked.length = 0;
  orderPage = { orders: [], page: 1, limit: 10, total: 0, hasMore: false };
  jobPage = { jobs: [], page: 1, limit: 10, total: 0, hasMore: false };
});

describe("orders for an elastic", () => {
  it("names the customer, the order and this elastic's quantity", () => {
    orderPage = { orders: [order()], page: 1, limit: 10, total: 1, hasMore: false };
    renderPanel();

    expect(screen.getByText("Acme Garments")).toBeInTheDocument();
    expect(screen.getByText("#1042")).toBeInTheDocument();
    expect(screen.getByText("PO PO-77")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("says how many there are in all, not just on this page", () => {
    // Ten rows out of three hundred read as the whole history unless the
    // total is stated.
    orderPage = { orders: [order()], page: 1, limit: 10, total: 312, hasMore: true };
    renderPanel();
    expect(screen.getByText("312 in all")).toBeInTheDocument();
  });

  it("explains an empty list rather than showing a bare table", () => {
    renderPanel();
    expect(screen.getByText("Never ordered")).toBeInTheDocument();
  });

  it("opens the order that was clicked", async () => {
    const user = userEvent.setup();
    orderPage = { orders: [order()], page: 1, limit: 10, total: 1, hasMore: false };
    renderPanel();

    await user.click(screen.getByText("Acme Garments"));
    expect(navigate).toHaveBeenCalledWith("/orders/o1");
  });
});

describe("jobs that produced an elastic", () => {
  it("shows what was planned, made and wasted", () => {
    jobPage = { jobs: [job()], page: 1, limit: 10, total: 1, hasMore: false };
    renderPanel();

    const row = screen.getByText("J-12").closest("tr")!;
    expect(within(row).getByText("400")).toBeInTheDocument();
    expect(within(row).getByText("380")).toBeInTheDocument();
    expect(within(row).getByText("20")).toBeInTheDocument();
  });

  it("points back at the order the job was raised against", () => {
    jobPage = { jobs: [job()], page: 1, limit: 10, total: 1, hasMore: false };
    renderPanel();
    expect(screen.getByText("order #1042")).toBeInTheDocument();
  });

  it("opens the job that was clicked", async () => {
    const user = userEvent.setup();
    jobPage = { jobs: [job()], page: 1, limit: 10, total: 1, hasMore: false };
    renderPanel();

    await user.click(screen.getByText("J-12"));
    expect(navigate).toHaveBeenCalledWith("/jobs/j1");
  });

  it("says cancelled jobs are left out, so the count is not read as everything", () => {
    renderPanel();
    expect(screen.getByText(/Cancelled jobs are excluded/)).toBeInTheDocument();
  });
});

describe("paging", () => {
  it("asks for the next page of orders without moving the jobs", async () => {
    // The two panels share a screen. A page number shared between them
    // would step both, and the reader would lose their place in one.
    const user = userEvent.setup();
    orderPage = { orders: [order()], page: 1, limit: 10, total: 45, hasMore: true };
    jobPage = { jobs: [job()], page: 1, limit: 10, total: 45, hasMore: true };
    renderPanel();

    const orderCard = screen.getByRole("region", { name: "Orders for this elastic" });
    await user.click(within(orderCard).getByRole("button", { name: /next page/i }));

    const lastAsked = (asked: number[]) => asked[asked.length - 1];
    expect(lastAsked(ordersAsked)).toBe(2);
    expect(lastAsked(jobsAsked)).toBe(1);
  });

  it("cannot page back from the first page", () => {
    orderPage = { orders: [order()], page: 1, limit: 10, total: 45, hasMore: true };
    renderPanel();
    expect(screen.getAllByRole("button", { name: /previous page/i })[0]).toBeDisabled();
  });

  it("counts the pages from the total, not from what arrived", () => {
    // 45 rows at 10 a page is 5 pages. Deriving it from the rows on
    // screen would say one, and the reader would never see the rest.
    orderPage = { orders: [order()], page: 1, limit: 10, total: 45, hasMore: true };
    renderPanel();
    expect(screen.getAllByText(/Showing 1–10 of 45/)[0]).toBeInTheDocument();
  });
});
