import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmployeeStat, MachineStat } from "../types";

function TrendIcon({ dir }: { dir: "up" | "down" | "stable" }) {
  if (dir === "up")
    return <TrendingUp className="h-4 w-4 text-status-success" aria-label="Trending up" />;
  if (dir === "down")
    return <TrendingDown className="h-4 w-4 text-status-danger" aria-label="Trending down" />;
  return <Minus className="h-4 w-4 text-ink-400" aria-label="Stable" />;
}

const th = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-400 whitespace-nowrap";
const td = "px-4 py-2.5 text-sm whitespace-nowrap";
const num = `${td} text-right tabular-nums`;

export function MachineTable({ rows }: { rows: MachineStat[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No machine data" description="No shifts recorded in this range." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-ink-100">
          <tr>
            <th className={th}>Machine</th>
            <th className={`${th} text-right`}>Shifts</th>
            <th className={`${th} text-right`}>Total (m)</th>
            <th className={`${th} text-right`}>Avg / shift</th>
            <th className={`${th} text-right`}>Per head</th>
            <th className={`${th} text-right`}>Consistency</th>
            <th className={`${th} text-right`}>Utilization</th>
            <th className={`${th} text-center`}>Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((m) => (
            <tr key={m.machineId} className="hover:bg-ink-100/40">
              <td className={td}>
                <span className="font-medium">#{m.machineNo}</span>{" "}
                <span className="text-ink-400">{m.manufacturer}</span>
              </td>
              <td className={num}>{m.shiftCount}</td>
              <td className={`${num} font-semibold`}>{m.totalProduction.toLocaleString("en-IN")}</td>
              <td className={num}>{m.avgPerShift.toLocaleString("en-IN")}</td>
              <td className={num}>{m.efficiencyPerHead.toLocaleString("en-IN")}</td>
              <td className={num}>{m.consistencyScore}%</td>
              <td className={num}>{m.utilizationPct}%</td>
              <td className={`${td} text-center`}>
                <span className="inline-flex"><TrendIcon dir={m.trendDirection} /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmployeeTable({ rows }: { rows: EmployeeStat[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No operator data" description="No shifts recorded in this range." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-ink-100">
          <tr>
            <th className={th}>Operator</th>
            <th className={th}>Department</th>
            <th className={`${th} text-right`}>Shifts</th>
            <th className={`${th} text-right`}>Total (m)</th>
            <th className={`${th} text-right`}>Avg / shift</th>
            <th className={`${th} text-right`}>Consistency</th>
            <th className={`${th} text-right`}>Improvement</th>
            <th className={`${th} text-right`}>Anomalies</th>
            <th className={`${th} text-center`}>Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((e) => (
            <tr key={e.employeeId} className="hover:bg-ink-100/40">
              <td className={`${td} font-medium`}>{e.name}</td>
              <td className={`${td} text-ink-600 capitalize`}>{e.department}</td>
              <td className={num}>{e.shiftCount}</td>
              <td className={`${num} font-semibold`}>{e.totalProduction.toLocaleString("en-IN")}</td>
              <td className={num}>{e.avgPerShift.toLocaleString("en-IN")}</td>
              <td className={num}>{e.consistencyScore}%</td>
              <td className={num}>
                <span
                  className={
                    e.improvement > 0
                      ? "text-status-success"
                      : e.improvement < 0
                        ? "text-status-danger"
                        : "text-ink-400"
                  }
                >
                  {e.improvement > 0 ? "+" : ""}
                  {e.improvement}%
                </span>
              </td>
              <td className={num}>{e.anomalyCount || "—"}</td>
              <td className={`${td} text-center`}>
                <span className="inline-flex"><TrendIcon dir={e.trendDirection} /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
