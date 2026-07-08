import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { AnalyticsFilters, ShiftFilter } from "../types";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7D", days: 6 },
  { label: "30D", days: 29 },
  { label: "90D", days: 89 },
] as const;

const SHIFTS: { label: string; value: ShiftFilter }[] = [
  { label: "All shifts", value: "all" },
  { label: "Day", value: "day" },
  { label: "Night", value: "night" },
];

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function presetRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
}) {
  const activePreset = PRESETS.find(
    (p) => presetRange(p.days).startDate === filters.startDate &&
           presetRange(p.days).endDate === filters.endDate
  );

  return (
    <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
      {/* Date presets */}
      <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange({ ...filters, ...presetRange(p.days) })}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activePreset?.label === p.label
                ? "bg-white shadow-sm text-ink-900"
                : "text-ink-600 hover:text-ink-900"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={filters.startDate}
          max={filters.endDate}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
          className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
        />
        <span className="text-ink-400">→</span>
        <input
          type="date"
          value={filters.endDate}
          min={filters.startDate}
          max={toISODate(new Date())}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
          className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Shift filter */}
      <div className="ml-auto flex items-center gap-1 rounded-lg bg-ink-100 p-1">
        {SHIFTS.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange({ ...filters, shift: s.value })}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              filters.shift === s.value
                ? "bg-white shadow-sm text-ink-900"
                : "text-ink-600 hover:text-ink-900"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
