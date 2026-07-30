import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sun, Moon, ArrowRight, CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useShiftDay, useShiftMutations } from "./hooks";
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
                {(summary!.production ?? 0).toLocaleString("en-IN")}
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

type Tab = "today" | "by-date";

export function ShiftPlansPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(toISODate(new Date()));
  const navigate = useNavigate();
  const { toast } = useToast();

  const today = useShiftDay();
  // Same endpoint, same summary shape — so a past date shows the identical
  // day/night cards rather than a bare list of links.
  const onDate = useShiftDay(date);
  const { createPlan } = useShiftMutations();

  const view = tab === "today" ? today : onDate;
  const isToday = date === toISODate(new Date());

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

      <div className="mb-4 flex gap-1 border-b border-ink-100">
        {([
          { id: "today", label: "Today" },
          { id: "by-date", label: "By date" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (tab === t.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-500 hover:text-ink-900")
            }
          >
            {t.id === "by-date" && <CalendarDays className="h-4 w-4" />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "by-date" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="plan-date" className="text-sm font-medium text-ink-600">
            Date
          </label>
          <input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-lg border border-ink-200 bg-surface px-3 text-sm focus:outline-none focus:border-brand-500"
          />
          <span className="text-sm text-ink-400">
            {new Date(date).toLocaleDateString("en-IN", {
              weekday: "long", day: "2-digit", month: "long", year: "numeric",
            })}
            {isToday && " · today"}
          </span>
        </div>
      )}

      {view.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ShiftCard
            summary={view.data?.dayShift}
            icon={<Sun className="h-4 w-4" />}
            label="Day shift"
            onOpen={openPlan}
          />
          <ShiftCard
            summary={view.data?.nightShift}
            icon={<Moon className="h-4 w-4" />}
            label="Night shift"
            onOpen={openPlan}
          />
        </div>
      )}

      <FormScreen open={createOpen} onClose={() => setCreateOpen(false)} title="New shift plan" width="max-w-2xl">
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
      </FormScreen>
    </>
  );
}

import { ShiftPlanForm as ShiftPlanFormLazy } from "./ShiftPlanForm";
