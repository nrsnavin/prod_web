import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "@/components/ui/Toast";
import { AssistantReportCard } from "./AssistantReportCard";
import type { AssistantReport } from "./api";

// A report Jarvis ran: the first rows on the answer, the whole thing one click away.

const download = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/reports/engine/api", () => ({ engineService: { download: (...a: unknown[]) => download(...a) } }));

const report: AssistantReport = {
  title: "Stock by category", sql: "SELECT category, SUM(value) FROM stock GROUP BY category",
  query: { dataset: "stock", select: ["category", { field: "value", agg: "sum" }], groupBy: ["category"] },
  period: { preset: "month" }, rangeLabel: "As of today", dataset: "stock", rowCount: 12,
  columns: [{ key: "category", label: "Category", type: "text" }, { key: "sum_value", label: "Value", type: "money" }],
  rows: [{ category: "warp", sum_value: 58400 }, { category: "rubber", sum_value: 15000 }],
  totals: { sum_value: 73400 },
};

function Where() { const l = useLocation(); return <p>at {l.pathname} {(l.state as { title?: string })?.title}</p>; }
const renderCard = () => render(
  <MemoryRouter initialEntries={["/assistant"]}>
    <ToastProvider>
      <Routes>
        <Route path="/assistant" element={<AssistantReportCard report={report} />} />
        <Route path="/reports/query" element={<Where />} />
      </Routes>
    </ToastProvider>
  </MemoryRouter>
);

describe("AssistantReportCard", () => {
  it("shows the first rows, in rupees, with the total", () => {
    renderCard();
    expect(screen.getByText("₹58,400")).toBeInTheDocument();
    expect(screen.getByText("₹73,400")).toBeInTheDocument();
    expect(screen.getByText(/first 2 of 12 rows/i)).toBeInTheDocument();
  });

  it("opens the whole report in the query builder", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /open as report/i }));
    expect(screen.getByText(/at \/reports\/query Stock by category/)).toBeInTheDocument();
  });

  it("downloads it as Excel with the same query and period", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: /excel/i }));
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ query: report.query, preset: "month" }), "xlsx", "Stock by category");
  });
});
