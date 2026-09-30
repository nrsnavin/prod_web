import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobalSearch, parseQuery } from "./GlobalSearch";

const get = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("@/core/auth/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", username: "N", role: "admin", department: "admin" } }),
}));

describe("parseQuery", () => {
  it.each([
    ["3", { jobNo: 3, orderNo: 3 }],
    ["J-3", { jobNo: 3 }],
    ["j3", { jobNo: 3 }],
    ["job 3", { jobNo: 3 }],
    ["#4", { orderNo: 4 }],
    ["order 4", { orderNo: 4 }],
    ["Order #4", { orderNo: 4 }],
    ["Kaveri", {}],
    ["PO-RUN-004", {}],
    ["LOOM-04", {}],
  ])("reads %p as %o", (q, expected) => {
    expect(parseQuery(q)).toEqual(expected);
  });
});

describe("GlobalSearch", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(async (url: string) => {
      if (url === "/job/jobs") return { jobs: [{ _id: "j3", jobOrderNo: 3, customer: { name: "Kaveri" } }] };
      if (url === "/order/list") return { orders: [{ _id: "o4", orderNo: 4, po: "PO-RUN-004", customer: { name: "Nila" } }] };
      if (url === "/machine/get-machines") return { machines: [{ _id: "m4", ID: "LOOM-04", status: "free" }, { _id: "m7", ID: "LOOM-07" }] };
      return {};
    });
  });

  const open = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <GlobalSearch open onClose={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("finds a job the way the app writes it", async () => {
    open();
    await userEvent.type(screen.getByLabelText("Search everything"), "J-3");
    expect(await screen.findByText("Job J-3")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/job/jobs", expect.objectContaining({ search: "3" }));
    // A number lookup does not also ask the name searches for "J-3".
    expect(get).not.toHaveBeenCalledWith("/customer/all-customers", expect.objectContaining({ search: "J-3" }));
  });

  it("finds an order by number and by customer PO", async () => {
    open();
    await userEvent.type(screen.getByLabelText("Search everything"), "#4");
    expect(await screen.findByText("Order #4")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/order/list", expect.objectContaining({ search: "4", status: "all" }));
  });

  it("finds a machine however its ID is typed", async () => {
    open();
    await userEvent.type(screen.getByLabelText("Search everything"), "loom 04");
    expect(await screen.findByText("LOOM-04")).toBeInTheDocument();
    expect(screen.queryByText("LOOM-07")).toBeNull();
  });
});
