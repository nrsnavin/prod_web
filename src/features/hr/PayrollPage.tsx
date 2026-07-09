import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, FileText, Check, X, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { payrollService, PayrollEmployeeRow } from "./api";

const payrollTone: Record<string, ChipTone> = {
  draft: "neutral",
  finalized: "info",
  paid: "success",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function PayslipModal({
  empId,
  name,
  year,
  month,
  onClose,
}: {
  empId: string;
  name: string;
  year: number;
  month: number;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["payslip", empId, year, month],
    queryFn: () => payrollService.slip(empId, year, month),
  });

  const rows: Array<[string, unknown]> = data
    ? [
        ["Total shifts", data.totalShifts],
        ["Present shifts", data.presentShifts],
        ["Absent shifts", data.absentShifts],
        ["Hourly rate", data.hourlyRate != null ? `₹${data.hourlyRate}` : undefined],
        ["Gross earnings", data.grossEarnings != null ? `₹${Number(data.grossEarnings).toLocaleString("en-IN")}` : undefined],
        ["Bonuses", data.totalBonuses != null ? `₹${Number(data.totalBonuses).toLocaleString("en-IN")}` : undefined],
        ["Deductions", data.totalDeductions != null ? `₹${Number(data.totalDeductions).toLocaleString("en-IN")}` : undefined],
        ["Advance deduction", data.totalAdvanceDeduction != null ? `₹${Number(data.totalAdvanceDeduction).toLocaleString("en-IN")}` : undefined],
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={`Payslip — ${name}`} width="max-w-md">
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <p className="text-sm text-status-danger">
          {(error as Error).message}
        </p>
      ) : data ? (
        <div className="print-area">
          <div className="hidden print:block mb-3 border-b border-ink-200 pb-2">
            <h1 className="text-lg font-bold">Payslip — {name}</h1>
            <p className="text-sm">{MONTHS[month - 1]} {year}</p>
          </div>
          <p className="text-sm text-ink-400 print:hidden">
            {MONTHS[month - 1]} {year}
          </p>
          <dl className="mt-3 divide-y divide-ink-100">
            {rows
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between py-2 text-sm">
                  <dt className="text-ink-600">{label}</dt>
                  <dd className="font-medium tabular-nums">{String(value)}</dd>
                </div>
              ))}
            <div className="flex justify-between py-3">
              <dt className="font-semibold">Net pay</dt>
              <dd className="text-xl font-bold tabular-nums">
                ₹{Number(data.netPay ?? 0).toLocaleString("en-IN")}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-end print:hidden">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print payslip
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function PayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"payroll" | "advances">("payroll");
  const [slip, setSlip] = useState<{ empId: string; name: string } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const dashboard = useQuery({
    queryKey: ["payroll", year, month],
    queryFn: () => payrollService.dashboard(year, month),
  });
  const advances = useQuery({
    queryKey: ["payroll", "advances"],
    queryFn: () => payrollService.advances(),
    enabled: tab === "advances",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["payroll"] });
  const generate = useMutation({
    mutationFn: () => payrollService.generate(year, month),
    onSuccess: invalidate,
  });
  const approveAdv = useMutation({ mutationFn: payrollService.approveAdvance, onSuccess: invalidate });
  const rejectAdv = useMutation({ mutationFn: payrollService.rejectAdvance, onSuccess: invalidate });

  const s = dashboard.data?.summary;

  const columns: Column<PayrollEmployeeRow>[] = [
    {
      key: "name",
      header: "Employee",
      render: (e) => (
        <div>
          <p className="font-medium">
            {e.name}
            {e.perfectAttendance && (
              <StatusChip tone="success" className="ml-2">Perfect</StatusChip>
            )}
          </p>
          <p className="text-xs text-ink-400 capitalize">{e.department}</p>
        </div>
      ),
    },
    { key: "shifts", header: "Shifts (P/A)", align: "right", render: (e) => `${e.presentShifts ?? 0} / ${e.absentShifts ?? 0}` },
    { key: "gross", header: "Gross (₹)", align: "right", render: (e) => (e.grossEarnings ?? 0).toLocaleString("en-IN") },
    { key: "bonus", header: "Bonus (₹)", align: "right", render: (e) => (e.totalBonuses ?? 0).toLocaleString("en-IN") },
    { key: "ded", header: "Deductions (₹)", align: "right", render: (e) => (e.totalDeductions ?? 0).toLocaleString("en-IN") },
    {
      key: "net",
      header: "Net pay (₹)",
      align: "right",
      render: (e) => <span className="font-bold">{e.netPay.toLocaleString("en-IN")}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusChip tone={payrollTone[e.status] ?? "neutral"}>{e.status}</StatusChip>,
    },
    {
      key: "slip",
      header: "",
      align: "right",
      render: (e) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(ev) => {
            ev.stopPropagation();
            setSlip({ empId: e.employeeId, name: e.name });
          }}
        >
          <FileText className="h-4 w-4" /> Slip
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Monthly payroll runs computed from attendance, bonuses and advances."
        actions={
          <Button
            loading={generate.isPending}
            onClick={() =>
              generate.mutate(undefined, {
                onSuccess: (r) => toast(r.message ?? "Payroll generated", "success"),
                onError: (e) =>
                  toast(e instanceof ApiError ? e.message : "Generation failed", "error"),
              })
            }
          >
            <Play className="h-4 w-4" /> Generate {MONTHS[month - 1]}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          value={String(month)}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="w-40"
        />
        <Select
          options={[0, 1, 2].map((d) => {
            const y = now.getFullYear() - d;
            return { value: String(y), label: String(y) };
          })}
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28"
        />
        <div className="ml-auto flex gap-1 rounded-lg bg-ink-100 p-1">
          {(["payroll", "advances"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium capitalize",
                tab === t ? "bg-white shadow-sm text-ink-900" : "text-ink-600"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "payroll" && (
        <>
          {dashboard.isLoading ? (
            <Skeleton className="h-24 w-full mb-4" />
          ) : (
            <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-4">
              {[
                { label: "Net payout", val: `₹${(s?.totalNetPay ?? 0).toLocaleString("en-IN")}` },
                { label: "Gross", val: `₹${(s?.totalGross ?? 0).toLocaleString("en-IN")}` },
                { label: "Deductions", val: `₹${(s?.totalDeductions ?? 0).toLocaleString("en-IN")}` },
                {
                  label: "Status",
                  val: `${s?.paidCount ?? 0} paid · ${s?.finalizedCount ?? 0} final · ${s?.draftCount ?? 0} draft`,
                },
              ].map((t) => (
                <Card key={t.label} className="p-4">
                  <p className="text-xs text-ink-400">{t.label}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{t.val}</p>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <DataTable
              columns={columns}
              rows={dashboard.data?.employees ?? []}
              rowKey={(e) => e.employeeId}
              loading={dashboard.isLoading}
              emptyTitle="No payroll generated"
              emptyDescription={`Generate ${MONTHS[month - 1]} ${year} to compute pay from attendance.`}
            />
          </Card>
        </>
      )}

      {tab === "advances" && (
        <Card className="p-5">
          <h3 className="font-semibold">Advance requests</h3>
          {advances.isLoading ? (
            <Skeleton className="mt-3 h-32 w-full" />
          ) : (advances.data?.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-ink-400">No advance requests.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {advances.data!.map((a) => (
                <li key={a._id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.employee?.name ?? "—"}</p>
                    <p className="text-xs text-ink-400">
                      {a.reason || "No reason given"}
                      {a.createdAt && ` · ${new Date(a.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <span className="font-bold tabular-nums">₹{a.amount.toLocaleString("en-IN")}</span>
                  {a.status === "pending" ? (
                    <span className="flex gap-1.5">
                      <Button
                        size="sm"
                        loading={approveAdv.isPending}
                        onClick={() =>
                          approveAdv.mutate(a._id, {
                            onSuccess: () => toast("Advance approved", "success"),
                            onError: (e) =>
                              toast(e instanceof ApiError ? e.message : "Failed", "error"),
                          })
                        }
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={rejectAdv.isPending}
                        onClick={() =>
                          rejectAdv.mutate(a._id, {
                            onSuccess: () => toast("Advance rejected", "success"),
                            onError: (e) =>
                              toast(e instanceof ApiError ? e.message : "Failed", "error"),
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </span>
                  ) : (
                    <StatusChip tone={a.status === "approved" ? "success" : "neutral"}>
                      {a.status}
                    </StatusChip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {slip && (
        <PayslipModal
          empId={slip.empId}
          name={slip.name}
          year={year}
          month={month}
          onClose={() => setSlip(null)}
        />
      )}
    </>
  );
}
