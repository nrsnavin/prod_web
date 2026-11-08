import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  Each payslip against the worker's own last three months, before it
//  is paid: what is unusual, said in figures. Nothing here changes a
//  slip — it is what to look at before the money goes out.
// ══════════════════════════════════════════════════════════════════

export interface PayFlag { code: string; severity: "high" | "check" | "info"; reason: string }
export interface PayrollCheckData {
  summary: { slips: number; high: number; check: number; info: number; totalNet: number; lastMonthNet: number };
  rows: { payrollId: string; employeeId: string; name: string; status: string; netPay: number; flags: PayFlag[] }[];
}

export const usePayrollCheck = (year: number, month: number) =>
  useQuery({
    queryKey: ["payroll", "check", year, month],
    queryFn: async () => (await httpClient.get<{ data: PayrollCheckData }>("/payroll/check", { year, month })).data,
  });

const tone = { high: "text-status-danger", check: "text-status-warning", info: "text-ink-500" } as const;

/** One worker's flags, for the pay dialog. */
export function PayFlags({ flags }: { flags: PayFlag[] }) {
  const shown = flags.filter((f) => f.severity !== "info");
  if (!shown.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-status-warning/40 bg-status-warning/5 p-3 text-sm">
      <p className="font-medium">Look at this before paying</p>
      <ul className="mt-1 list-disc pl-5">
        {shown.map((f) => <li key={f.code} className={tone[f.severity]}>{f.reason}</li>)}
      </ul>
    </div>
  );
}

export function PayrollCheckPanel({ year, month }: { year: number; month: number }) {
  const { data } = usePayrollCheck(year, month);
  const [all, setAll] = useState(false);
  if (!data || !data.summary.slips) return null;
  const rows = all ? data.rows : data.rows.filter((r) => r.flags.some((f) => f.severity !== "info"));
  const s = data.summary;
  const change = s.lastMonthNet ? Math.round(((s.totalNet - s.lastMonthNet) / s.lastMonthNet) * 100) : null;

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn("h-5 w-5", s.high ? "text-status-danger" : s.check ? "text-status-warning" : "text-status-success")} />
          <h3 className="font-semibold">
            {s.high + s.check ? `${s.high + s.check} payslip${s.high + s.check === 1 ? "" : "s"} to look at before paying` : "Nothing unusual in this month's payslips"}
          </h3>
        </div>
        <p className="text-xs text-ink-500">
          Total ₹{s.totalNet.toLocaleString("en-IN")}{change != null ? ` · ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% on last month` : ""}
          {s.info ? (
            <button className="ml-2 text-brand-600 hover:underline" onClick={() => setAll((v) => !v)}>{all ? "Hide notes" : `Show ${s.info} note${s.info === 1 ? "" : "s"} too`}</button>
          ) : null}
        </p>
      </div>
      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {rows.map((r) => (
            <li key={r.payrollId} className="flex flex-wrap gap-x-3 py-1.5">
              <span className="w-40 font-medium">{r.name}</span>
              <span className="flex-1">
                {r.flags.filter((f) => all || f.severity !== "info").map((f) => <span key={f.code} className={cn("mr-3", tone[f.severity])}>{f.reason}</span>)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
