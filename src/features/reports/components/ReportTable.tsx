import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ReportColumn } from "../types";

const nf = (n: number) => n.toLocaleString("en-IN");
const cf = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function formatCell(value: unknown, format: ReportColumn["format"]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "currency") return cf(Number(value));
  if (format === "number") return nf(Number(value));
  return String(value);
}

const isNumeric = (f: ReportColumn["format"]) => f === "number" || f === "currency";

/**
 * Config-driven report table: renders any report's { columns, rows }
 * with per-column formatting and right-aligned numerics. The first
 * column is the row label; numeric columns get a totals-free header
 * that right-aligns to match the cells.
 */
export function ReportTable<T extends Record<string, unknown>>({
  columns,
  rows,
  loading,
  emptyText = "No data in this period.",
  title,
}: {
  columns: ReportColumn[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  title?: string;
}) {
  return (
    <Card>
      {title && (
        <div className="border-b border-ink-100 px-5 py-3">
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={"px-5 py-2.5 font-medium " + (isNumeric(c.format) ? "text-right" : "")}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-ink-50">
                  {columns.map((c) => (
                    <td key={c.key} className="px-5 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10 text-center text-ink-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40">
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={
                        "px-5 py-3 " +
                        (isNumeric(c.format) ? "text-right tabular-nums " : "") +
                        (ci === 0 ? "font-medium" : "text-ink-600")
                      }
                    >
                      {formatCell(row[c.key], c.format)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
