import { httpClient } from "@/core/http/httpClient";
import { ProductionReport, ReportFilters } from "./types";

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

  // Streams the same report as a CSV and triggers a browser download.
  async downloadCsv(reportPath: string, filenameBase: string, filters: ReportFilters): Promise<void> {
    const blob = await httpClient.getBlob(reportPath, { ...toParams(filters), format: "csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
