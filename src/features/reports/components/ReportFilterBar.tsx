import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Download, FileText } from "lucide-react";
import { Preset, ReportFilters } from "../types";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "fy", label: "Financial year" },
  { value: "custom", label: "Custom" },
];

export interface GroupByOption {
  value: string;
  label: string;
}

/**
 * Shared report controls: preset chips + custom from/to, a group-by
 * selector, a compare-to-previous toggle, and CSV / Print actions.
 * Report-agnostic — pass the current filters, a setter, and the
 * group-by options for the active report.
 */
export function ReportFilterBar({
  filters,
  onChange,
  groupByOptions,
  onExportCsv,
  onExportPdf,
  exporting,
}: {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  groupByOptions: GroupByOption[];
  onExportCsv: () => void;
  onExportPdf: () => void;
  exporting?: "csv" | "pdf" | null;
}) {
  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card className="mb-4 p-4 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        {/* Preset chips */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = filters.preset === p.value;
            return (
              <button
                key={p.value}
                onClick={() => set({ preset: p.value })}
                className={
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (active
                    ? "bg-brand-500 text-white"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {filters.preset === "custom" && (
          <div className="flex items-end gap-2">
            <Input
              label="From"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => set({ from: e.target.value })}
              className="w-40"
            />
            <Input
              label="To"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => set({ to: e.target.value })}
              className="w-40"
            />
          </div>
        )}

        <Select
          label="Group by"
          options={groupByOptions}
          value={filters.groupBy}
          onChange={(e) => set({ groupBy: e.target.value as ReportFilters["groupBy"] })}
          className="w-44"
        />

        <label className="flex items-center gap-2 pb-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={filters.compare}
            onChange={(e) => set({ compare: e.target.checked })}
            className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/30"
          />
          Compare to previous period
        </label>

        <div className="ml-auto flex items-end gap-2">
          <Button variant="secondary" onClick={onExportPdf} loading={exporting === "pdf"}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button variant="secondary" onClick={onExportCsv} loading={exporting === "csv"}>
            <Download className="h-4 w-4" /> Excel / CSV
          </Button>
        </div>
      </div>
    </Card>
  );
}
