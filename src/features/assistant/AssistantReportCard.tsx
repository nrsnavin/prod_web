import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, FileText, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { engineService } from "@/features/reports/engine/api";
import type { AssistantReport } from "./api";

// ══════════════════════════════════════════════════════════════════
//  A report Jarvis ran to answer a question: the first rows, and the
//  way to the whole thing — open it in the query builder (to change,
//  save or share), or download it as PDF or Excel.
// ══════════════════════════════════════════════════════════════════

const fmt = (v: unknown, type: string) => {
  if (typeof v !== "number") return v == null ? "" : String(v);
  const n = v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return type === "money" ? `₹${n}` : n;
};

export function AssistantReportCard({ report }: { report: AssistantReport }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"" | "pdf" | "xlsx">("");
  const payload = { query: report.query, title: report.title, ...report.period };

  const download = async (format: "pdf" | "xlsx") => {
    setBusy(format);
    try { await engineService.download(payload, format, report.title); } catch (e) { toast(e instanceof Error ? e.message : "Could not download it", "error"); } finally { setBusy(""); }
  };
  const hasTotals = Object.keys(report.totals ?? {}).length > 0;

  return (
    <div className="mt-2 rounded-lg border border-ink-200 bg-surface p-3 text-ink-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{report.title}</p>
        <p className="text-xs text-ink-500">{report.rangeLabel} · {report.rowCount} row{report.rowCount === 1 ? "" : "s"}</p>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-left text-ink-500">
              {report.columns.map((c) => <th key={c.key} className="px-2 py-1 font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r, i) => (
              <tr key={i} className="border-t border-ink-100">
                {report.columns.map((c) => (
                  <td key={c.key} className={c.type === "money" || c.type === "number" ? "px-2 py-1 text-right" : "px-2 py-1"}>{fmt(r[c.key], c.type)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasTotals && (
            <tfoot>
              <tr className="border-t border-ink-200 font-medium">
                {report.columns.map((c, i) => (
                  <td key={c.key} className={c.type === "money" || c.type === "number" ? "px-2 py-1 text-right" : "px-2 py-1"}>
                    {report.totals[c.key] != null ? fmt(report.totals[c.key], c.type) : i === 0 ? "Total" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {report.rowCount > report.rows.length && <p className="mt-1 text-xs text-ink-500">First {report.rows.length} of {report.rowCount} rows — open it for the rest.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => navigate("/reports/query", { state: { query: report.query, title: report.title, period: report.period } })}>
          <TableProperties className="h-4 w-4" /> Open as report
        </Button>
        <Button size="sm" variant="ghost" loading={busy === "pdf"} onClick={() => download("pdf")}><FileText className="h-4 w-4" /> PDF</Button>
        <Button size="sm" variant="ghost" loading={busy === "xlsx"} onClick={() => download("xlsx")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
      </div>
    </div>
  );
}
