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
import { bonusService, BonusRecordRow, BonusPreviewRow } from "./api";

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
    { key: "tier", header: "Attendance", align: "right", render: (r) => `${r.attendanceRate}% · ${r.attendanceTier} ×${r.multiplier}` },
    { key: "amount", header: "Approx bonus (₹)", align: "right", render: (r) => <span className="font-bold">{r.bonusAmount.toLocaleString("en-IN")}</span> },
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

      {cfg?.status !== "triggered" && (
        <Card className="mb-4">
          <div className="px-5 pt-5">
            <h3 className="font-semibold flex items-center gap-2">
              <Gift className="h-4 w-4 text-brand-500" /> Approximate bonus
              {pv?.approximate && <StatusChip tone="warning">approximate</StatusChip>}
            </h3>
            <p className="mt-1 text-sm text-ink-400">
              {pv?.approximate
                ? `Provisional figures — they finalize when you generate on ${diwaliLabel ?? "the Diwali month"}. Amounts grow as each month's payroll is paid.`
                : diwaliLabel
                ? `It's the Diwali month (${diwaliLabel}). Review the figures below and generate to lock them in.`
                : "Set the Diwali date in the bonus config to define the window and enable generation."}
              {pv && (
                <> Projected total: <span className="font-semibold text-ink-600">₹{pv.totalPayout.toLocaleString("en-IN")}</span>.</>
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
      )}

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
