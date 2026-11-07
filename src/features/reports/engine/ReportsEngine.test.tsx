import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReportsLandingPage } from "../ReportsLandingPage";
import { ReportRunPage } from "./ReportRunPage";
import { QueryBuilderPage, toQuery, toSql } from "./QueryBuilderPage";

// Every report in one place; one opened, filtered and downloaded; one
// built from dropdowns or written as SQL, run and saved.

const datasets = [{
  id: "sales", label: "Sales (invoice lines)", description: "Every line of every issued tax invoice.", dated: true,
  fields: [
    { key: "date", label: "Date", type: "date", agg: null }, { key: "customer", label: "Customer", type: "text", agg: null },
    { key: "customerGroup", label: "Customer group", type: "text", agg: null }, { key: "invoiceNo", label: "Invoice", type: "text", agg: null },
    { key: "taxable", label: "Taxable value", type: "money", agg: "sum" }, { key: "quantity", label: "Quantity", type: "number", agg: "sum" },
  ],
}];
const catalog = {
  success: true, datasets, presets: [],
  reports: [
    { id: "sales-by-customer", group: "Sales", title: "Sales by customer", description: "Invoiced value and metres per customer.", dated: true, query: { dataset: "sales", select: ["customer", { field: "taxable", agg: "sum" }], groupBy: ["customer"] } },
    { id: "production-by-machine", group: "Production", title: "Production by machine", description: "Verified metres per loom.", dated: true, query: { dataset: "production", select: [], groupBy: [] } },
  ],
  saved: [{ _id: "s1", name: "Innerwear sales", query: { dataset: "sales", select: ["customer"], groupBy: ["customer"] }, sql: "SELECT customer, SUM(taxable) FROM sales WHERE customer_group = 'Innerwear' GROUP BY customer", preset: "fy", shared: true, createdByName: "Owner" }],
};
const runResult = {
  success: true, title: "Sales by customer", rangeLabel: "This month", filterLine: "", query: catalog.reports[0].query,
  result: { dataset: "sales", datasetLabel: "Sales", columns: [{ key: "customer", label: "Customer", type: "text" }, { key: "sum_taxable", label: "Total taxable value", type: "money" }], rows: [{ customer: "Lux Exports", sum_taxable: 6000 }, { customer: "Sunrise Garments", sum_taxable: 3500 }], totals: { sum_taxable: 9500 }, rowCount: 2, truncated: false },
};

const get = vi.fn(async (url: string, _p?: unknown) => (url === "/reports/catalog" ? catalog : runResult));
const getBlob = vi.fn(async () => new Blob(["x"]));
const post = vi.fn(async () => ({ saved: { _id: "s2" } }));
vi.mock("@/core/http/httpClient", () => ({
  httpClient: { get: (u: string, p?: unknown) => get(u, p), getBlob: (...a: unknown[]) => getBlob(...(a as [])), post: (...a: unknown[]) => post(...(a as [])), delete: vi.fn() },
  ApiError: class extends Error {},
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const payloadOf = (call: unknown[]) => JSON.parse((call[1] as { payload: string }).payload);

const at = (path: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reports" element={<ReportsLandingPage />} />
        <Route path="/reports/r/:id" element={<ReportRunPage />} />
        <Route path="/reports/query" element={<QueryBuilderPage />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => { get.mockClear(); getBlob.mockClear(); post.mockClear(); URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn(); });

describe("the reports home", () => {
  it("lists every report by area, the saved ones, and finds one by name", async () => {
    at("/reports");
    expect(await screen.findByRole("link", { name: /Sales by customer/ })).toHaveAttribute("href", "/reports/r/sales-by-customer");
    expect(screen.getByRole("link", { name: /Innerwear sales/ })).toHaveAttribute("href", "/reports/query?saved=s1");
    expect(screen.getByRole("link", { name: /Production dashboard/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Find a report"), "machine");
    expect(screen.queryByRole("link", { name: /Sales by customer/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Production by machine/ })).toBeInTheDocument();
  });
});

describe("a ready-made report", () => {
  it("runs for the period, narrows with a filter, totals, and downloads Excel and PDF", async () => {
    at("/reports/r/sales-by-customer");
    expect(await screen.findByText("Lux Exports")).toBeInTheDocument();
    expect(screen.getByText("₹9,500.00")).toBeInTheDocument();
    expect(payloadOf(get.mock.calls.find((c) => c[0] === "/reports/run")!)).toEqual({ report: "sales-by-customer", filters: [], preset: "month" });

    await userEvent.selectOptions(screen.getByLabelText("Period"), "last_fy");
    await userEvent.click(screen.getByRole("button", { name: /Add a filter/ }));
    await userEvent.selectOptions(screen.getByLabelText("Filter 1 field"), "customerGroup");
    await userEvent.type(screen.getByLabelText("Filter 1 value"), "Innerwear");
    const last = () => payloadOf(get.mock.calls.filter((c) => c[0] === "/reports/run").at(-1)!);
    await vi.waitFor(() => expect(last()).toEqual({ report: "sales-by-customer", filters: [{ field: "customerGroup", op: "=", value: "Innerwear" }], preset: "last_fy" }));

    await userEvent.click(screen.getByRole("button", { name: /Excel/ }));
    expect(getBlob).toHaveBeenCalledWith("/reports/run", { payload: JSON.stringify({ report: "sales-by-customer", filters: [{ field: "customerGroup", op: "=", value: "Innerwear" }], preset: "last_fy", format: "xlsx" }) });
    await userEvent.click(screen.getByRole("button", { name: /PDF/ }));
    expect(JSON.parse((getBlob.mock.calls.at(-1) as unknown as [string, { payload: string }])[1].payload).format).toBe("pdf");
  });
});

describe("building a report", () => {
  it("turns the dropdowns into a query and SQL", () => {
    const q = toQuery("sales", ["customer"], [{ field: "taxable", agg: "sum" }, { field: "invoiceNo", agg: "countd" }], [], [{ field: "customerGroup", op: "in", value: "Innerwear, Exporters" }, { field: "customer", op: "=", value: "" }], { key: "sum_taxable", dir: "desc" }, "10");
    expect(q).toEqual({ dataset: "sales", select: ["customer", { field: "taxable", agg: "sum" }, { field: "invoiceNo", agg: "countd" }], groupBy: ["customer"], where: [{ field: "customerGroup", op: "in", value: "Innerwear, Exporters" }], orderBy: [{ key: "sum_taxable", dir: "desc" }], limit: 10 });
    expect(toSql(q)).toBe("SELECT customer, SUM(taxable), COUNT(DISTINCT invoiceNo)\nFROM sales\nWHERE customerGroup IN ('Innerwear', 'Exporters')\nGROUP BY customer\nORDER BY sum_taxable DESC\nLIMIT 10");
  });

  it("builds from dropdowns, runs, and saves", async () => {
    at("/reports/query");
    await userEvent.click(await screen.findByRole("button", { name: /Group by a column/ }));
    await userEvent.click(screen.getByRole("button", { name: /Add a total/ }));
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("Sunrise Garments")).toBeInTheDocument();
    const p = payloadOf(get.mock.calls.filter((c) => c[0] === "/reports/run").at(-1)!);
    expect(p.query).toEqual({ dataset: "sales", select: ["customer", { field: "taxable", agg: "sum" }], groupBy: ["customer"], where: [] });
    await userEvent.type(screen.getByLabelText("Save as"), "My sales");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(post).toHaveBeenCalledWith("/reports/saved", expect.objectContaining({ name: "My sales", query: p.query, preset: "month", shared: false }));
  });

  it("opens a saved SQL query in the SQL box and runs it", async () => {
    at("/reports/query?saved=s1");
    const box = await screen.findByLabelText("SQL");
    expect(box).toHaveValue(catalog.saved[0].sql);
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    const p = payloadOf(get.mock.calls.filter((c) => c[0] === "/reports/run").at(-1)!);
    expect(p).toEqual({ sql: catalog.saved[0].sql, title: "Innerwear sales", preset: "fy" });
    expect(within(await screen.findByRole("table")).getByText("Lux Exports")).toBeInTheDocument();
  });
});
