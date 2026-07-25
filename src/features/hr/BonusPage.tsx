import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Play, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { Input } from "@/components/ui/Input";
import { CalendarDays, Settings2, RotateCcw } from "lucide-react";
import { bonusService, BonusRecordRow, BonusPreviewRow } from "./api";

// The Diwali date, label and thresholds that drive the whole module. Without
// a date set nothing can be generated, so this has to be visible and
// editable on the page rather than buried in the database.
function BonusConfigPanel({ year }: { year: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["bonus", "config", year],
    queryFn: () => bonusService.config(year),
  });
  const cfg = data?.config;
  const [form, setForm] = useState<Record<string, string>>({});
  const [resetOpen, setResetOpen] = useState(false);
  const val = (k: string, fallback: unknown) =>
    form[k] ?? (fallback == null ? "" : String(fallback));

  const reset = useMutation({
    mutationFn: () => bonusService.resetYear(year),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["bonus"] });
      toast(r.message ?? `Reset ${year} bonus`, "success");
      setResetOpen(false);
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Reset failed", "error"),
  });

  const save = useMutation({
    mutationFn: () =>
      bonusService.saveConfig({
        year,
        bonusDate: val("bonusDate", cfg?.bonusDate ? String(cfg.bonusDate).slice(0, 10) : "") || undefined,
        bonusLabel: val("bonusLabel", cfg?.bonusLabel),
        yearlyWorkingDays: Number(val("yearlyWorkingDays", cfg?.yearlyWorkingDays ?? 300)),
        minDaysForEligibility: Number(val("minDaysForEligibility", cfg?.minDaysForEligibility ?? 30)),
        minBonusPercent: Number(val("minBonusPercent", cfg?.minBonusPercent ?? 8.33)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bonus"] });
      toast("Bonus settings saved", "success");
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Save failed", "error"),
  });

  if (isLoading) return <Skeleton className="mb-4 h-32 w-full" />;

  const locked = cfg?.status === "triggered" || cfg?.status === "completed";
  // Once records are PAID the year can't be reopened — the denominator that
  // produced those amounts has to stay put.
  const hasPaid = (data?.stats?.paidRecords ?? 0) > 0;

  return (
    <Card className="mb-4 p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <CalendarDays className="h-4 w-4 text-brand-500" /> Diwali bonus settings {year}
        {!cfg?.bonusDate && <StatusChip tone="warning">date not set</StatusChip>}
        {locked && <StatusChip tone="info">locked — {cfg?.status}</StatusChip>}
      </h3>

      {locked && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-warning/40 bg-status-warningBg p-3">
          <p className="text-sm text-ink-600">
            {hasPaid ? (
              <>
                <span className="font-medium">Working days can't be changed</span> — {data?.stats?.paidRecords} bonus
                record{(data?.stats?.paidRecords ?? 0) > 1 ? "s have" : " has"} already been paid, and the amounts were
                computed from the current value. Reset clears only the <em>unpaid</em> records.
              </>
            ) : (
              <>
                <span className="font-medium">Working days are locked</span> because {year}'s bonus has been generated.
                Reset clears the generated (unpaid) records so you can change the settings and generate again.
              </>
            )}
          </p>
          <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Reset {year} bonus
          </Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          label="Diwali date"
          type="date"
          value={val("bonusDate", cfg?.bonusDate ? String(cfg.bonusDate).slice(0, 10) : "")}
          onChange={(e) => setForm((f) => ({ ...f, bonusDate: e.target.value }))}
          hint="Defines the 12-month window and when generation unlocks"
        />
        <Input
          label="Label"
          value={val("bonusLabel", cfg?.bonusLabel)}
          onChange={(e) => setForm((f) => ({ ...f, bonusLabel: e.target.value }))}
          placeholder={`Diwali ${year}`}
        />
        <Input
          label="Working days / year"
          type="number"
          disabled={locked}
          value={val("yearlyWorkingDays", cfg?.yearlyWorkingDays ?? 300)}
          onChange={(e) => setForm((f) => ({ ...f, yearlyWorkingDays: e.target.value }))}
          hint={locked ? "Reset the year to change this" : "Attendance-rate denominator"}
          className={locked ? "bg-ink-100 text-ink-400" : undefined}
        />
        <Input
          label="Min days to qualify"
          type="number"
          value={val("minDaysForEligibility", cfg?.minDaysForEligibility ?? 30)}
          onChange={(e) => setForm((f) => ({ ...f, minDaysForEligibility: e.target.value }))}
          hint="0 = everyone qualifies"
        />
        <Input
          label="Min bonus %"
          type="number"
          step="0.01"
          value={val("minBonusPercent", cfg?.minBonusPercent ?? 8.33)}
          onChange={(e) => setForm((f) => ({ ...f, minBonusPercent: e.target.value }))}
          hint="Floor on the effective rate (8.33 = statutory)"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {!locked && (data?.stats?.totalRecords ?? 0) > 0 && (
          <Button variant="secondary" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Reset {year}
          </Button>
        )}
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          <Settings2 className="h-4 w-4" /> Save settings
        </Button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={`Reset ${year} bonus?`}
        message={
          hasPaid
            ? `This deletes the ${data?.stats?.pendingRecords ?? 0} UNPAID bonus record(s) for ${year} and removes them from employee ledgers. The ${data?.stats?.paidRecords} already-paid record(s) are kept and the year stays completed, so working days remain locked.`
            : `This deletes the ${data?.stats?.totalRecords ?? 0} generated bonus record(s) for ${year} and removes them from employee ledgers, unlocking the settings so you can change them and generate again. Paid records are never deleted.`
        }
        confirmLabel="Reset bonus"
        loading={reset.isPending}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => reset.mutate()}
      />
    </Card>
  );
}

export function BonusPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [triggerOpen, setTriggerOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const config = useQuery({
    queryKey: ["bonus", "config", year],
    queryFn: () => bonusService.config(year),
  });
  const records = useQuery({
    queryKey: ["bonus", "records", year],
    queryFn: () => bonusService.records(year),
  });
  const preview = useQuery({
    queryKey: ["bonus", "preview", year],
    queryFn: () => bonusService.preview(year),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bonus"] });
  const trigger = useMutation({ mutationFn: () => bonusService.trigger(year), onSuccess: invalidate });
  const pay = useMutation({ mutationFn: bonusService.payRecord, onSuccess: invalidate });

  const stats = config.data?.stats;
  const cfg = config.data?.config;
  const pv = preview.data;
  const diwaliLabel = pv?.diwaliDate
    ? new Date(pv.diwaliDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : null;

  const previewColumns: Column<BonusPreviewRow>[] = [
    {
      key: "emp",
      header: "Employee",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-ink-400 capitalize">{r.department}</p>
        </div>
      ),
    },
    { key: "salary", header: "Window salary (₹)", align: "right", render: (r) => (r.annualEarnings).toLocaleString("en-IN") },
    { key: "pct", header: "Percent", align: "right", render: (r) => `${r.bonusPercent}%` },
    {
      key: "tier",
      header: "Attendance",
      align: "right",
      render: (r) => (
        <div className="text-right">
          <p className="tabular-nums">{r.attendanceRate}% · {r.attendanceTier} ×{r.multiplier}</p>
          {r.attendanceDays != null && (
            <p className="text-xs text-ink-400 tabular-nums">
              {r.attendanceDays}/{r.totalWorkingDays} days
              {r.attendanceSource === "scheduled_shifts" && " · from roster"}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Predicted bonus (₹)",
      align: "right",
      render: (r) =>
        r.eligible === false ? (
          <StatusChip tone="warning">under {r.minDaysForEligibility ?? 30} days</StatusChip>
        ) : (
          <span className="font-bold">{r.bonusAmount.toLocaleString("en-IN")}</span>
        ),
    },
  ];

  const columns: Column<BonusRecordRow>[] = [
    {
      key: "emp",
      header: "Employee",
      render: (r) => (
        <div>
          <p className="font-medium">{r.employee?.name ?? "—"}</p>
          <p className="text-xs text-ink-400 capitalize">{r.employee?.department ?? ""}</p>
        </div>
      ),
    },
    { key: "days", header: "Days worked", align: "right", render: (r) => r.daysWorked ?? "—" },
    { key: "pct", header: "Percent", align: "right", render: (r) => (r.percent != null ? `${r.percent}%` : "—") },
    {
      key: "amount",
      header: "Bonus (₹)",
      align: "right",
      render: (r) => <span className="font-bold">{r.bonusAmount.toLocaleString("en-IN")}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusChip tone={r.status === "paid" ? "success" : "warning"}>{r.status}</StatusChip>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      render: (r) =>
        r.status !== "paid" ? (
          <Button
            size="sm"
            variant="secondary"
            loading={pay.isPending}
            onClick={() =>
              pay.mutate(r._id, {
                onSuccess: () => toast("Bonus marked paid", "success"),
                onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
              })
            }
          >
            <Check className="h-4 w-4" /> Mark paid
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Diwali bonus"
        subtitle="Percent of salary received over the Diwali year, scaled by attendance."
        actions={
          cfg?.status !== "triggered" && (
            <Button disabled={!pv?.canGenerate} onClick={() => setTriggerOpen(true)}>
              <Play className="h-4 w-4" />{" "}
              {pv?.canGenerate
                ? `Generate ${year} bonus`
                : diwaliLabel
                ? `Available in ${diwaliLabel}`
                : "Set Diwali date first"}
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Select
          options={[0, 1, 2].map((d) => ({ value: String(currentYear - d), label: String(currentYear - d) }))}
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28"
        />
      </div>

      {config.isLoading ? (
        <Skeleton className="h-24 w-full mb-4" />
      ) : (
        <div className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Total payout", val: `₹${(stats?.totalPayout ?? 0).toLocaleString("en-IN")}` },
            { label: "Records", val: stats?.totalRecords ?? 0 },
            { label: "Paid", val: stats?.paidRecords ?? 0 },
            { label: "Pending", val: stats?.pendingRecords ?? 0 },
          ].map((t) => (
            <Card key={t.label} className="p-4">
              <p className="text-xs text-ink-400">{t.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{t.val}</p>
            </Card>
          ))}
        </div>
      )}

      <BonusConfigPanel year={year} />

      {/* Prediction from current performance — always visible, including
          after generating, so the live figures can be compared with what
          was locked in. */}
      <Card className="mb-4">
        <div className="px-5 pt-5">
          <h3 className="font-semibold flex items-center gap-2">
            <Gift className="h-4 w-4 text-brand-500" /> Bonus prediction — current performance
            {pv?.approximate && <StatusChip tone="warning">projection</StatusChip>}
            {cfg?.status === "triggered" && <StatusChip tone="info">already generated</StatusChip>}
          </h3>
          <p className="mt-1 text-sm text-ink-400">
            {!pv?.configured
              ? "Set the Diwali date above to define the 12-month window and enable generation."
              : pv?.approximate
              ? `Provisional — figures finalize when you generate on ${diwaliLabel}. Amounts grow as each month's payroll is paid.`
              : `It's the Diwali month (${diwaliLabel}). Review below and generate to lock the figures in.`}
            {pv && (
              <>
                {" "}Projected total:{" "}
                <span className="font-semibold text-ink-600">₹{pv.totalPayout.toLocaleString("en-IN")}</span>
                {pv.ineligibleCount ? (
                  <> · <span className="text-status-warning">{pv.ineligibleCount} below the {pv.config?.minDaysForEligibility ?? 30}-day threshold</span></>
                ) : null}
                .
              </>
            )}
          </p>
        </div>
        <DataTable
          columns={previewColumns}
          rows={pv?.rows ?? []}
          rowKey={(r) => r.employeeId}
          loading={preview.isLoading}
          emptyTitle="No employees to preview"
        />
      </Card>

      <Card>
        <h3 className="font-semibold px-5 pt-5 flex items-center gap-2">
          <Gift className="h-4 w-4 text-brand-500" /> Bonus records {year}
          {cfg?.status && (
            <StatusChip tone={cfg.status === "triggered" ? "info" : "neutral"}>
              {cfg.status}
            </StatusChip>
          )}
        </h3>
        <DataTable
          columns={columns}
          rows={records.data ?? []}
          rowKey={(r) => r._id}
          loading={records.isLoading}
          emptyTitle="No bonus records"
          emptyDescription={`Trigger the ${year} bonus to compute per-employee amounts.`}
        />
      </Card>

      <ConfirmDialog
        open={triggerOpen}
        title={`Trigger ${year} bonus?`}
        message="Bonus amounts are computed for all eligible employees from their attendance. Working-days config locks after triggering."
        confirmLabel="Trigger"
        loading={trigger.isPending}
        onCancel={() => setTriggerOpen(false)}
        onConfirm={() =>
          trigger.mutate(undefined, {
            onSuccess: () => {
              setTriggerOpen(false);
              toast("Bonus triggered", "success");
            },
            onError: (e) => {
              setTriggerOpen(false);
              toast(e instanceof ApiError ? e.message : "Trigger failed", "error");
            },
          })
        }
      />
    </>
  );
}
