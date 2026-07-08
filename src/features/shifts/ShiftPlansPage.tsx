import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sun, Moon, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { usePlansOnDate, useShiftMutations, useTodayShifts } from "./hooks";
import { TodayShiftSummary } from "./types";
import { toISODate } from "@/features/analytics/components/FilterBar";

function ShiftCard({
  summary,
  icon,
  label,
  onOpen,
}: {
  summary?: TodayShiftSummary;
  icon: React.ReactNode;
  label: string;
  onOpen?: (id: string) => void;
}) {
  const created = summary && summary.status !== "not_created" && summary.id;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-lg bg-ink-100 grid place-items-center text-ink-600">
          {icon}
        </span>
        <h3 className="font-semibold">{label}</h3>
        <span className="ml-auto">
          {created ? (
            <StatusChip tone="success">planned</StatusChip>
          ) : (
            <StatusChip tone="neutral">not created</StatusChip>
          )}
        </span>
      </div>
      {created ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {(summary!.production ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-ink-400">meters</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{summary!.machinesRunning ?? 0}</p>
              <p className="text-xs text-ink-400">machines</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{summary!.operatorCount ?? 0}</p>
              <p className="text-xs text-ink-400">operators</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4 w-full"
            onClick={() => summary!.id && onOpen?.(summary!.id)}
          >
            View plan <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-400">No plan yet for this shift.</p>
      )}
    </Card>
  );
}

export function ShiftPlansPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [date, setDate] = useState(toISODate(new Date()));
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = useTodayShifts();
  const onDate = usePlansOnDate(date);
  const { createPlan } = useShiftMutations();

  const openPlan = (id: string) => navigate(`/shift-plans/${id}`);

  return (
    <>
      <PageHeader
        title="Shift plans"
        subtitle="Assign machines and operators to day & night shifts."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New shift plan
          </Button>
        }
      />

      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-400 mb-2">Today</h3>
      {today.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ShiftCard
            summary={today.data?.dayShift}
            icon={<Sun className="h-4 w-4" />}
            label="Day shift"
            onOpen={openPlan}
          />
          <ShiftCard
            summary={today.data?.nightShift}
            icon={<Moon className="h-4 w-4" />}
            label="Night shift"
            onOpen={openPlan}
          />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          Browse a date
        </h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-lg border border-ink-200 px-2 text-sm focus:outline-none focus:border-brand-500"
        />
      </div>
      <Card className="mt-2 p-4">
        {onDate.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (onDate.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-400">No shift plans on {new Date(date).toLocaleDateString()}.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {onDate.data!.map((p) => (
              <li key={p._id}>
                <button
                  onClick={() => openPlan(p._id)}
                  className="w-full flex items-center justify-between py-2.5 text-left text-sm hover:bg-ink-100/40 rounded-lg px-2 -mx-2"
                >
                  <span className="font-medium flex items-center gap-2">
                    {p.shift === "DAY" ? <Sun className="h-4 w-4 text-status-warning" /> : <Moon className="h-4 w-4 text-ink-400" />}
                    {p.shift} shift
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New shift plan" width="max-w-2xl">
        <ShiftPlanFormLazy
          submitting={createPlan.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            createPlan.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Shift plan created", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to create plan", "error"),
            })
          }
        />
      </Modal>
    </>
  );
}

import { ShiftPlanForm as ShiftPlanFormLazy } from "./ShiftPlanForm";
