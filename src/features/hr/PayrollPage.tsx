import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, FileText, Check, X, Printer, Plus, FileDown, Settings2, Wallet } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError } from "@/core/http/httpClient";
import { payrollService, PayrollEmployeeRow, PayrollSettings, MonthRange, PayrollRangeRow } from "./api";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";

const payrollTone: Record<string, ChipTone> = {
  draft: "neutral",
  finalized: "info",
  partially_paid: "warning",
  paid: "success",
};

const inr = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;

// requested → approved → paid_out → recovered (rejected is terminal)
const advanceTone: Record<string, ChipTone> = {
  requested: "warning",
  pending: "warning",
  approved: "info",
  paid_out: "success",
  recovered: "neutral",
  rejected: "danger",
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
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["payslip", empId, year, month],
    queryFn: () => payrollService.slip(empId, year, month),
  });

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await payrollService.slipPdf(empId, year, month);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not generate the PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

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
        ["Cash paid", data.totalCashPaid ? `₹${Number(data.totalCashPaid).toLocaleString("en-IN")}` : undefined],
        ["Advance recovered at payment", data.advanceRecoveredAtPayment ? `₹${Number(data.advanceRecoveredAtPayment).toLocaleString("en-IN")}` : undefined],
        ["Total settled", data.amountPaid ? `₹${Number(data.amountPaid).toLocaleString("en-IN")}` : undefined],
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
          {/* A real table so the printed sheet has ruled rows and repeating
              headers, not a run of flex rows. */}
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([label, value]) => (
                  <tr key={label} className="border-b border-ink-100">
                    <td className="py-2 text-ink-600">{label}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{String(value)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink-200">
                <td className="py-3 font-semibold">Net pay</td>
                <td className="py-3 text-right text-xl font-bold tabular-nums">
                  ₹{Number(data.netPay ?? 0).toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-4 flex justify-end gap-2 print:hidden">
            <Button variant="secondary" size="sm" loading={downloading} onClick={downloadPdf}>
              <FileDown className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print payslip
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// Record a payment against a payroll slip — full remaining net or a custom
// (partial) amount. Shows any outstanding advances for context; a draft is
// auto-finalized by the backend when paid.
function PayDialog({ row, onClose }: { row: PayrollEmployeeRow; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const remaining = Math.max(0, (row.netPay ?? 0) - (row.amountPaid ?? 0));
  const [note, setNote] = useState("");
  // employeeId → amount to hold back against that advance
  const [recover, setRecover] = useState<Record<string, string>>({});

  const advances = useQuery({
    queryKey: ["emp-advances", row.employeeId],
    queryFn: () => payrollService.employeeAdvances(row.employeeId),
  });
  // Money the employee is actually holding and still owes back.
  const outstanding = (advances.data ?? []).filter(
    (a) => ["paid_out", "approved"].includes(a.status) && (a.remainingBalance ?? 0) > 0
  );

  const recoverTotal = Object.values(recover).reduce((s, v) => s + (Number(v) || 0), 0);
  // Cash defaults to whatever is left after the selected recoveries.
  const [cashEdited, setCashEdited] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const autoCash = Math.max(0, remaining - recoverTotal);
  const cash = cashEdited ? Number(amount) || 0 : autoCash;

  const pay = useMutation({
    mutationFn: () =>
      payrollService.pay(row.id!, {
        amount: cash,
        paymentNote: note.trim() || undefined,
        recoverAdvances: Object.entries(recover)
          .filter(([, v]) => Number(v) > 0)
          .map(([advance, v]) => ({ advance, amount: Number(v) })),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      toast(
        r.data.status === "paid"
          ? `Paid — ₹${r.cashPaid.toLocaleString("en-IN")} cash${r.advanceRecovered ? `, ₹${r.advanceRecovered.toLocaleString("en-IN")} advance recovered` : ""}`
          : "Partial payment recorded",
        "success"
      );
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Payment failed", "error"),
  });

  const settled = cash + recoverTotal;
  const invalid = settled <= 0 || settled > remaining;
  const partial = settled > 0 && settled < remaining;

  return (
    <FormScreen open onClose={onClose} title={`Pay — ${row.name}`} width="max-w-md">
      <div className="space-y-4">
        <div className="rounded-lg border border-ink-200 p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-ink-600">Net pay</span>
            <span className="font-medium tabular-nums">{inr(row.netPay)}</span>
          </div>
          {(row.amountPaid ?? 0) > 0 && (
            <div className="flex justify-between py-0.5">
              <span className="text-ink-600">Already paid</span>
              <span className="font-medium tabular-nums">{inr(row.amountPaid)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-ink-100 pt-1.5">
            <span className="font-semibold">Remaining</span>
            <span className="font-bold tabular-nums">{inr(remaining)}</span>
          </div>
        </div>

        {(row.totalAdvanceDeduction ?? 0) > 0 && (
          <p className="text-xs text-ink-400">
            This month's net already recovers {inr(row.totalAdvanceDeduction)} in advances.
          </p>
        )}

        {outstanding.length > 0 && (
          <div className="rounded-lg bg-ink-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Recover advances from this payment
            </p>
            <ul className="mt-2 space-y-2">
              {outstanding.map((a) => {
                const bal = a.remainingBalance ?? 0;
                return (
                  <li key={a._id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.reason || "Advance"}</p>
                      <p className="text-xs text-ink-400 tabular-nums">{inr(bal)} outstanding</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={bal}
                      placeholder="0"
                      value={recover[a._id] ?? ""}
                      onChange={(e) => setRecover((r) => ({ ...r, [a._id]: e.target.value }))}
                      className="h-9 w-24 rounded-lg border border-ink-200 bg-white px-2 text-sm tabular-nums"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setRecover((r) => ({ ...r, [a._id]: String(Math.min(bal, remaining)) }))
                      }
                    >
                      All
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Cash to hand over (₹)"
                type="number"
                min="0"
                value={cashEdited ? amount : String(autoCash)}
                onChange={(e) => { setCashEdited(true); setAmount(e.target.value); }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setCashEdited(false); setAmount(String(autoCash)); }}
            >
              Auto
            </Button>
          </div>
          {recoverTotal > 0 && (
            <div className="mt-2 rounded-lg border border-ink-200 p-2 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-ink-600">Cash</span>
                <span className="tabular-nums">{inr(cash)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-ink-600">Advance recovered</span>
                <span className="tabular-nums">{inr(recoverTotal)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-ink-100 pt-1 font-semibold">
                <span>Settles</span>
                <span className="tabular-nums">{inr(settled)}</span>
              </div>
            </div>
          )}
          {settled > remaining && (
            <p className="mt-1 text-xs text-status-danger">
              Cash + recovery ({inr(settled)}) exceeds the {inr(remaining)} remaining.
            </p>
          )}
          {partial && (
            <p className="mt-1 text-xs text-status-warning">
              Partial payment — the slip will be marked partially paid.
            </p>
          )}
        </div>

        <Input
          label="Payment note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. paid by bank transfer"
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={invalid} loading={pay.isPending} onClick={() => pay.mutate()}>
            <Check className="h-4 w-4" /> {partial ? "Pay part" : "Pay in full"}
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}

// Admin/finance records an advance given to an employee. Born approved
// with the deduction month set — the enterer IS the approver.
function AddAdvanceForm({
  defaultYear,
  defaultMonth,
  onClose,
}: {
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [employee, setEmployee] = useState("");
  const [amount, setAmount] = useState("");
  const [dMonth, setDMonth] = useState(defaultMonth);
  const [dYear, setDYear] = useState(defaultYear);
  const [reason, setReason] = useState("");

  const emps = useQuery({
    queryKey: ["payroll", "employees"],
    queryFn: payrollService.payrollEmployees,
  });

  const save = useMutation({
    mutationFn: () =>
      payrollService.createAdvance({
        employee,
        amount: Number(amount),
        deductMonth: dMonth,
        deductYear: dYear,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      toast("Advance recorded", "success");
      onClose();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to record advance", "error"),
  });

  const submit = () => {
    if (!employee) return toast("Pick an employee", "error");
    if (!(Number(amount) > 0)) return toast("Amount must be greater than 0", "error");
    save.mutate();
  };

  return (
    <FormScreen open onClose={onClose} title="Add advance" width="max-w-md">
      <div className="space-y-4">
        <Select
          label="Employee"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          placeholder={emps.isLoading ? "Loading…" : "Select employee"}
          options={(emps.data ?? []).map((e) => ({
            value: e.id,
            label: e.department ? `${e.name} — ${e.department}` : e.name,
          }))}
        />
        <Input
          label="Amount (₹)"
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Recover in month"
            value={String(dMonth)}
            onChange={(e) => setDMonth(Number(e.target.value))}
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
          <Select
            label="Year"
            value={String(dYear)}
            onChange={(e) => setDYear(Number(e.target.value))}
            options={[defaultYear - 1, defaultYear, defaultYear + 1].map((y) => ({
              value: String(y),
              label: String(y),
            }))}
          />
        </div>
        <Input
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. medical emergency"
        />
        <p className="text-xs text-ink-400">
          Recorded as already approved — it will be recovered from the selected month's payroll.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={save.isPending} onClick={submit}>Record advance</Button>
        </div>
      </div>
    </FormScreen>
  );
}

const SETTING_GROUPS: { title: string; fields: { key: keyof PayrollSettings; label: string }[] }[] = [
  { title: "Leave & penalties", fields: [
    { key: "casualLeavesPerMonth", label: "Casual leaves / month" },
    { key: "sickLeavesPerMonth", label: "Sick leaves / month" },
    { key: "lateGracePeriodMinutes", label: "Late grace (min)" },
    { key: "penaltyPerExcessAbsent", label: "Excess-absent penalty (₹)" },
  ]},
  { title: "Bonuses (₹)", fields: [
    { key: "noLeaveBonus", label: "No-leave bonus" },
    { key: "perfectAttendanceBonus", label: "Perfect attendance" },
    { key: "streakBonusPer7Shifts", label: "Per 7-shift streak" },
  ]},
  { title: "Overtime", fields: [
    { key: "overtimeMultiplier", label: "OT multiplier (×)" },
    { key: "overtimeGraceMinutes", label: "OT grace (min)" },
  ]},
  { title: "Statutory (0 = off)", fields: [
    { key: "pfPercent", label: "PF %" },
    { key: "pfWageCeiling", label: "PF wage ceiling (₹)" },
    { key: "esiPercent", label: "ESI %" },
    { key: "esiWageCeiling", label: "ESI wage ceiling (₹)" },
  ]},
];

function SettingsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["payroll", "settings"], queryFn: () => payrollService.settings() });
  const [form, setForm] = useState<Partial<PayrollSettings>>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: () => payrollService.saveSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll", "settings"] }); toast("Settings saved", "success"); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
  });
  const set = (k: keyof PayrollSettings, v: string) => setForm((p) => ({ ...p, [k]: Number(v) }));

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <Card className="p-5">
      <div className="space-y-5">
        {SETTING_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{g.title}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {g.fields.map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  type="number"
                  value={String(form[f.key] ?? 0)}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-400">
        PF/ESI stay off while their % is 0. A wage ceiling of 0 means no ceiling.
      </p>
      <div className="mt-4 flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          <Settings2 className="h-4 w-4" /> Save settings
        </Button>
      </div>
    </Card>
  );
}

// Payroll summed across a month window — one row per employee, read-only
// (paying happens per month). Powers the payroll page's "Range" view.
function PayrollRangeView({ range }: { range: MonthRange }) {
  const q = useQuery({
    queryKey: ["payroll-range", range],
    queryFn: () => payrollService.dashboardRange(range),
  });
  const s = q.data?.summary;

  const columns: Column<PayrollRangeRow>[] = [
    {
      key: "name",
      header: "Employee",
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-ink-400 capitalize">{e.department}</p>
        </div>
      ),
    },
    { key: "months", header: "Months", align: "right", render: (e) => e.months },
    { key: "gross", header: "Gross (₹)", align: "right", render: (e) => (e.grossEarnings ?? 0).toLocaleString("en-IN") },
    { key: "bonus", header: "Bonus (₹)", align: "right", render: (e) => (e.totalBonuses ?? 0).toLocaleString("en-IN") },
    { key: "ded", header: "Deductions (₹)", align: "right", render: (e) => (e.totalDeductions ?? 0).toLocaleString("en-IN") },
    { key: "net", header: "Net (₹)", align: "right", render: (e) => <span className="font-bold">{e.netPay.toLocaleString("en-IN")}</span> },
    { key: "paid", header: "Paid (₹)", align: "right", render: (e) => (e.amountPaid ?? 0).toLocaleString("en-IN") },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <StatusChip tone={e.fullyPaid ? "success" : "warning"}>
          {e.fullyPaid ? "paid" : `${e.paidMonths}/${e.months} paid`}
        </StatusChip>
      ),
    },
  ];

  return (
    <>
      {q.isLoading ? (
        <Skeleton className="h-24 w-full mb-4" />
      ) : (
        <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Net payout", val: inr(s?.totalNetPay) },
            { label: "Gross", val: inr(s?.totalGross) },
            { label: "Deductions", val: inr(s?.totalDeductions) },
            { label: "Paid out", val: inr(s?.totalPaid) },
            { label: "Employees", val: String(s?.totalEmployees ?? 0) },
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
          rows={q.data?.employees ?? []}
          rowKey={(e) => e.employeeId}
          loading={q.isLoading}
          emptyTitle="No payroll in this range"
          emptyDescription="No generated payroll for the selected months."
        />
      </Card>
    </>
  );
}

export function PayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<"payroll" | "advances" | "settings">("payroll");
  const [mode, setMode] = useState<"month" | "range">("month");
  const [range, setRange] = useState<MonthRange>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth() - 5, 1);
    return {
      fromYear: from.getFullYear(), fromMonth: from.getMonth() + 1,
      toYear: to.getFullYear(), toMonth: to.getMonth() + 1,
    };
  });
  const [slip, setSlip] = useState<{ empId: string; name: string } | null>(null);
  const [payRow, setPayRow] = useState<PayrollEmployeeRow | null>(null);
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
  // Approving recovers the advance in the page's selected payroll month.
  const approveAdv = useMutation({
    mutationFn: (id: string) => payrollService.approveAdvance(id, month, year),
    onSuccess: invalidate,
  });
  const rejectAdv = useMutation({ mutationFn: payrollService.rejectAdvance, onSuccess: invalidate });
  // Handing the cash over — this is what books it to the employee's ledger.
  const payOutAdv = useMutation({ mutationFn: payrollService.payOutAdvance, onSuccess: invalidate });
  const [addAdvOpen, setAddAdvOpen] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const runGenerate = () =>
    generate.mutate(undefined, {
      onSuccess: (r) => {
        toast(r.message ?? "Payroll generated", "success");
        // Surface anyone skipped for a missing hourly rate — a missing
        // rate is a missing paycheck, so it must not pass silently.
        if (r.skipped?.length) {
          toast(
            `Skipped (no hourly rate): ${r.skipped.map((e) => e.name).join(", ")}`,
            "error"
          );
        }
        setConfirmGenerate(false);
      },
      onError: (e) => toast(e instanceof ApiError ? e.message : "Generation failed", "error"),
    });

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
      render: (e) => (
        <div>
          <StatusChip tone={payrollTone[e.status] ?? "neutral"}>
            {e.status.replace("_", " ")}
          </StatusChip>
          {e.status === "partially_paid" && (
            <p className="mt-0.5 text-xs text-ink-400 tabular-nums">
              {inr(e.amountPaid)} of {inr(e.netPay)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <div className="flex justify-end gap-1">
          {e.status !== "paid" && e.id && (
            <Button
              variant="primary"
              size="sm"
              onClick={(ev) => {
                ev.stopPropagation();
                setPayRow(e);
              }}
            >
              <Wallet className="h-4 w-4" /> Pay
            </Button>
          )}
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
        </div>
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
            onClick={() => setConfirmGenerate(true)}
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
          {(["payroll", "advances", "settings"] as const).map((t) => (
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
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
              {(["month", "range"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium capitalize",
                    mode === m ? "bg-white shadow-sm text-ink-900" : "text-ink-600"
                  )}
                >
                  {m === "month" ? "Single month" : "Range"}
                </button>
              ))}
            </div>
            {mode === "range" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-400">From</span>
                <Select
                  className="w-32"
                  value={String(range.fromMonth)}
                  onChange={(e) => setRange((r) => ({ ...r, fromMonth: Number(e.target.value) }))}
                  options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                />
                <Select
                  className="w-24"
                  value={String(range.fromYear)}
                  onChange={(e) => setRange((r) => ({ ...r, fromYear: Number(e.target.value) }))}
                  options={[0, 1, 2].map((d) => { const y = now.getFullYear() - d; return { value: String(y), label: String(y) }; })}
                />
                <span className="text-ink-400">to</span>
                <Select
                  className="w-32"
                  value={String(range.toMonth)}
                  onChange={(e) => setRange((r) => ({ ...r, toMonth: Number(e.target.value) }))}
                  options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                />
                <Select
                  className="w-24"
                  value={String(range.toYear)}
                  onChange={(e) => setRange((r) => ({ ...r, toYear: Number(e.target.value) }))}
                  options={[0, 1, 2].map((d) => { const y = now.getFullYear() - d; return { value: String(y), label: String(y) }; })}
                />
              </div>
            )}
          </div>

          {mode === "range" ? (
            <PayrollRangeView range={range} />
          ) : (
          <>
          {dashboard.isLoading ? (
            <Skeleton className="h-24 w-full mb-4" />
          ) : (
            <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Net payout", val: `₹${(s?.totalNetPay ?? 0).toLocaleString("en-IN")}` },
                { label: "Gross", val: `₹${(s?.totalGross ?? 0).toLocaleString("en-IN")}` },
                { label: "Deductions", val: `₹${(s?.totalDeductions ?? 0).toLocaleString("en-IN")}` },
                {
                  label: "Paid out",
                  val: `₹${(s?.totalPaid ?? 0).toLocaleString("en-IN")}`,
                },
                {
                  label: "Status",
                  val: `${s?.paidCount ?? 0} paid · ${s?.partiallyPaidCount ?? 0} part · ${s?.draftCount ?? 0} draft`,
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
        </>
      )}

      {tab === "advances" && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Advance requests</h3>
            <Button size="sm" onClick={() => setAddAdvOpen(true)}>
              <Plus className="h-4 w-4" /> Add advance
            </Button>
          </div>
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
                  <div className="text-right">
                    <span className="font-bold tabular-nums">₹{a.amount.toLocaleString("en-IN")}</span>
                    {a.status === "approved" && a.remainingBalance != null && (
                      <p className="text-xs text-ink-400 tabular-nums">
                        {a.remainingBalance <= 0
                          ? "fully recovered"
                          : `₹${a.remainingBalance.toLocaleString("en-IN")} left to recover`}
                      </p>
                    )}
                  </div>
                  {a.status === "requested" || a.status === "pending" ? (
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
                  ) : a.status === "approved" ? (
                    // Approved but the cash hasn't left yet — paying out is
                    // what puts it on the employee's ledger.
                    <Button
                      size="sm"
                      loading={payOutAdv.isPending}
                      onClick={() =>
                        payOutAdv.mutate(a._id, {
                          onSuccess: () => toast("Advance paid out", "success"),
                          onError: (e) =>
                            toast(e instanceof ApiError ? e.message : "Failed", "error"),
                        })
                      }
                    >
                      <Wallet className="h-4 w-4" /> Pay out
                    </Button>
                  ) : (
                    <StatusChip tone={advanceTone[a.status] ?? "neutral"}>
                      {a.status.replace("_", " ")}
                    </StatusChip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "settings" && <SettingsPanel />}

      {addAdvOpen && (
        <AddAdvanceForm defaultYear={year} defaultMonth={month} onClose={() => setAddAdvOpen(false)} />
      )}

      {payRow && <PayDialog row={payRow} onClose={() => setPayRow(null)} />}

      {slip && (
        <PayslipModal
          empId={slip.empId}
          name={slip.name}
          year={year}
          month={month}
          onClose={() => setSlip(null)}
        />
      )}

      <ConfirmDialog
        open={confirmGenerate}
        title={`Generate ${MONTHS[month - 1]} ${year} payroll?`}
        message="This recomputes pay for every employee from attendance, bonuses and advances for the selected month, replacing any existing draft run."
        confirmLabel="Generate"
        loading={generate.isPending}
        onCancel={() => setConfirmGenerate(false)}
        onConfirm={runGenerate}
      />
    </>
  );
}
