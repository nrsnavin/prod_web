import { httpClient } from "@/core/http/httpClient";
import { DispatchReport, OrderBookReport, ProductionReport, ReportFilters, StockMovementsReport, StockPurchasesReport } from "./types";

// Only send from/to for a custom range; presets are resolved server-side.
function toParams(f: ReportFilters): Record<string, unknown> {
  const p: Record<string, unknown> = { groupBy: f.groupBy, compare: f.compare };
  if (f.preset === "custom") {
    if (f.from) p.from = f.from;
    if (f.to) p.to = f.to;
  } else {
    p.preset = f.preset;
  }
  return p;
}

export const reportsService = {
  async production(filters: ReportFilters): Promise<ProductionReport> {
    const res = await httpClient.get<{ success: boolean; report: ProductionReport }>(
      "/reports/production",
      toParams(filters)
    );
    return res.report;
  },

  async dispatch(filters: ReportFilters): Promise<DispatchReport> {
    const res = await httpClient.get<{ success: boolean; report: DispatchReport }>(
      "/reports/dispatch",
      toParams(filters)
    );
    return res.report;
  },

  async orderBook(filters: ReportFilters): Promise<OrderBookReport> {
    const res = await httpClient.get<{ success: boolean; report: OrderBookReport }>(
      "/reports/order-book",
      toParams(filters)
    );
    return res.report;
  },

  async stockPurchases(filters: ReportFilters): Promise<StockPurchasesReport> {
    const res = await httpClient.get<{ success: boolean; report: StockPurchasesReport }>(
      "/reports/stock-purchases",
      toParams(filters)
    );
    return res.report;
  },

  async stockMovements(filters: ReportFilters): Promise<StockMovementsReport> {
    const res = await httpClient.get<{ success: boolean; report: StockMovementsReport }>(
      "/reports/stock-movements",
      toParams(filters)
    );
    return res.report;
  },

  // Streams the report in the given format (csv | pdf) as a real file
  // download — no browser print / screen capture.
  async download(reportPath: string, filenameBase: string, filters: ReportFilters, format: "csv" | "pdf"): Promise<void> {
    const blob = await httpClient.getBlob(reportPath, { ...toParams(filters), format });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  downloadCsv(reportPath: string, filenameBase: string, filters: ReportFilters): Promise<void> {
    return this.download(reportPath, filenameBase, filters, "csv");
  },

  downloadPdf(reportPath: string, filenameBase: string, filters: ReportFilters): Promise<void> {
    return this.download(reportPath, filenameBase, filters, "pdf");
  },
};
