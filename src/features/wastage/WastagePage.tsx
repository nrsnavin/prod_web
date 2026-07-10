import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ChevronDown, ChevronUp, Trash2, Sparkles, AlertTriangle, Info, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Combobox } from "@/components/ui/Combobox";
import { SearchInput } from "@/components/ui/SearchInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusChip } from "@/components/ui/StatusChip";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useEmployees } from "@/features/employees/hooks";
import {
  useEligibleJobs,
  useWastageAnalytics,
  useWastageByJob,
  useWastageJobs,
  useWastageMutations,
  useWastageRootCause,
} from "./hooks";
import { WastageFormValues, WastageRecord } from "./types";

const schema = z.object({
  job: z.string().min(1, "Select job"),
  elastic: z.string().min(1, "Select elastic"),
  employee: z.string().min(1, "Select employee"),
  quantity: z.coerce.number().positive("Qty > 0"),
  penalty: z.coerce.number().min(0).optional(),
  reason: z.string().min(1, "Reason is required"),
});

function AddWastageForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const jobs = useEligibleJobs();
  const employees = useEmployees("all");
  const { add } = useWastageMutations();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WastageFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { job: "", elastic: "", employee: "", quantity: 0, penalty: 0, reason: "" },
  });

  const jobId = watch("job");
  const selectedJob = (jobs.data ?? []).find((j) => j._id === jobId);
  const elasticOptions = (selectedJob?.elastics ?? [])
    .map((l) => (typeof l.elastic === "object" && l.elastic ? l.elastic : null))
    .filter((e): e is { _id: string; name: string } => !!e)
    .map((e) => ({ value: e._id, label: e.name }));

  return (
    <form
      onSubmit={handleSubmit((values) =>
        add.mutate(values, {
          onSuccess: () => {
            toast("Wastage recorded", "success");
            onDone();
          },
          onError: (e) =>
            toast(e instanceof ApiError ? e.message : "Failed to record wastage", "error"),
        })
      )}
      className="space-y-4"
      noValidate
    >
      <Controller control={control} name="job" render={({ field }) => (
        <Combobox
          label="Job (weaving / finishing / checking) *"
          placeholder={jobs.isLoading ? "Loading…" : "Select job"}
          options={(jobs.data ?? []).map((j) => ({
            value: j._id,
            label: `J-${j.jobOrderNo}${j.customer?.name ? ` — ${j.customer.name}` : ""} (${j.status})`,
          }))}
          error={errors.job?.message}
          value={field.value}
          onChange={field.onChange}
        />
      )} />
      <div className="grid grid-cols-2 gap-3">
        <Controller control={control} name="elastic" render={({ field }) => (
          <Combobox
            label="Elastic *"
            placeholder="Select elastic"
            options={elasticOptions}
            error={errors.elastic?.message}
            value={field.value}
            onChange={field.onChange}
          />
        )} />
        <Controller control={control} name="employee" render={({ field }) => (
          <Combobox
            label="Employee *"
            placeholder="Select employee"
            options={(employees.data ?? []).map((e) => ({ value: e._id, label: e.name }))}
            error={errors.employee?.message}
            value={field.value}
            onChange={field.onChange}
          />
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantity (m) *" type="number" step="0.01" error={errors.quantity?.message} {...register("quantity")} />
        <Input label="Penalty (₹)" type="number" step="0.01" {...register("penalty")} />
      </div>
      <Input label="Reason *" placeholder="e.g. Beam change waste" error={errors.reason?.message} {...register("reason")} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={add.isPending}>Record wastage</Button>
      </div>
    </form>
  );
}

function WastageEditModal({
  record,
  open,
  onClose,
}: {
  record: WastageRecord;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { update } = useWastageMutations();
  const [quantity, setQuantity] = useState(String(record.quantity));
  const [penalty, setPenalty] = useState(String(record.penalty ?? 0));
  const [reason, setReason] = useState(record.reason ?? "");
  const [auditReason, setAuditReason] = useState("");

  const save = () => {
    if (auditReason.trim().length < 3) {
      toast("Give a reason (min 3 chars) for the edit", "error");
      return;
    }
    if (!(Number(quantity) > 0)) {
      toast("Quantity must be greater than 0", "error");
      return;
    }
    update.mutate(
      { id: record._id, body: { quantity: Number(quantity), penalty: Number(penalty) || 0, reason, auditReason: auditReason.trim() } },
      {
        onSuccess: () => { toast("Wastage updated", "success"); onClose(); },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to update", "error"),
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit wastage" width="max-w-md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity (m) *" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Penalty (₹)" type="number" step="0.01" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
        </div>
        <Input label="Reason (cause)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-600">Reason for edit *</label>
          <textarea
            rows={2}
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="Why is this being changed? (recorded in the audit log)"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" loading={update.isPending} onClick={save}>Save changes</Button>
        </div>
      </div>
    </Modal>
  );
}

function WastageRow({ w }: { w: WastageRecord }) {
  const { toast } = useToast();
  const { remove } = useWastageMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <Trash2 className="h-4 w-4 text-status-danger shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {typeof w.elastic === "object" && w.elastic ? w.elastic.name : "—"}
        </p>
        <p className="text-xs text-ink-400">
          {typeof w.employee === "object" && w.employee ? w.employee.name : "—"} · {w.reason}
          {w.createdAt && ` · ${new Date(w.createdAt).toLocaleDateString()}`}
        </p>
      </div>
      {(w.penalty ?? 0) > 0 && (
        <span className="text-xs text-ink-400">₹{w.penalty} penalty</span>
      )}
      <span className="font-semibold tabular-nums text-status-danger">
        {w.quantity.toLocaleString("en-IN")} m
      </span>
      <button
        onClick={() => setEditOpen(true)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
        aria-label="Edit wastage"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => setDelOpen(true)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
        aria-label="Delete wastage"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <WastageEditModal record={w} open={editOpen} onClose={() => setEditOpen(false)} />
      <ReasonDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Delete wastage record"
        description="This reverses the job's wastage counter and is recorded in the audit trail."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={(reason) =>
          remove.mutate(
            { id: w._id, auditReason: reason },
            {
              onSuccess: () => { toast("Wastage deleted", "success"); setDelOpen(false); },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed to delete", "error"),
            }
          )
        }
      />
    </li>
  );
}

function JobWastages({ jobId }: { jobId: string }) {
  const { data, isLoading } = useWastageByJob(jobId);
  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-ink-100 px-4 pb-3">
      {(data ?? []).map((w) => (
        <WastageRow key={w._id} w={w} />
      ))}
      {(data?.length ?? 0) === 0 && (
        <li className="py-3 text-sm text-ink-400">No wastage records.</li>
      )}
    </ul>
  );
}

export function WastagePage() {
  const [tab, setTab] = useState<"jobs" | "summary" | "rootCause">("jobs");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const jobs = useWastageJobs(search);
  const analytics = useWastageAnalytics(days);
  const rootCause = useWastageRootCause(days);

  return (
    <>
      <PageHeader
        title="Wastage"
        subtitle="Recorded during weaving, finishing and checking."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Record wastage
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-ink-200">
        {(["jobs", "summary", "rootCause"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px",
              tab === t
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-600 hover:text-ink-900"
            )}
          >
            {t === "jobs" ? "By job" : t === "summary" ? "Summary" : "Root cause"}
          </button>
        ))}
      </div>

      {tab === "jobs" && (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by job number…"
            className="max-w-xs mb-4"
          />
          {jobs.isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (jobs.data?.length ?? 0) === 0 ? (
            <Card>
              <EmptyState title="No wastage recorded" description="Jobs with wastage entries appear here." />
            </Card>
          ) : (
            <div className="space-y-3">
              {jobs.data!.map((j) => {
                const isOpen = expanded === j._id;
                return (
                  <Card key={j._id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : j._id)}
                      className="w-full flex items-center gap-4 p-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">J-{j.jobOrderNo}</p>
                        <p className="text-xs text-ink-400">{j.customer?.name ?? ""}</p>
                      </div>
                      <StatusChip tone="neutral">{j.status}</StatusChip>
                      <div className="text-right">
                        <p className="font-bold tabular-nums text-status-danger">
                          {j.totalWastage.toLocaleString("en-IN")} m
                        </p>
                        <p className="text-xs text-ink-400">{j.wastageCount} entries</p>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-ink-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-ink-400" />
                      )}
                    </button>
                    {isOpen && <JobWastages jobId={j._id} />}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "summary" && (
        <>
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium",
                  days === d ? "bg-white shadow-sm text-ink-900" : "text-ink-600"
                )}
              >
                {d}D
              </button>
            ))}
          </div>

          {analytics.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : analytics.data ? (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-4">
                <Card className="p-4">
                  <p className="text-xs text-ink-400">Total wastage</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-status-danger">
                    {analytics.data.totalWastage.toLocaleString("en-IN")} m
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-ink-400">Entries</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums">
                    {analytics.data.totalCount.toLocaleString("en-IN")}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-ink-400">Penalties</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums">
                    ₹{analytics.data.totalPenalty.toLocaleString("en-IN")}
                  </p>
                </Card>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="font-semibold">Top employees by wastage</h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {analytics.data.topEmployees.map((e, i) => (
                      <li key={i} className="flex justify-between py-2 text-sm">
                        <span>
                          {e.name}
                          {e.department && (
                            <span className="text-ink-400"> · {e.department}</span>
                          )}
                        </span>
                        <span className="tabular-nums font-semibold">
                          {e.total.toLocaleString("en-IN")} m
                          <span className="text-ink-400 font-normal"> ({e.count})</span>
                        </span>
                      </li>
                    ))}
                    {analytics.data.topEmployees.length === 0 && (
                      <li className="py-3 text-sm text-ink-400">No data</li>
                    )}
                  </ul>
                </Card>
                <Card className="p-5">
                  <h3 className="font-semibold">By elastic</h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {analytics.data.byElastic.map((e, i) => (
                      <li key={i} className="flex justify-between py-2 text-sm">
                        <span>{e.name}</span>
                        <span className="tabular-nums font-semibold">
                          {e.total.toLocaleString("en-IN")} m
                          <span className="text-ink-400 font-normal"> ({e.count})</span>
                        </span>
                      </li>
                    ))}
                    {analytics.data.byElastic.length === 0 && (
                      <li className="py-3 text-sm text-ink-400">No data</li>
                    )}
                  </ul>
                </Card>
              </div>
            </>
          ) : null}
        </>
      )}

      {tab === "rootCause" && (
        <>
          <div className="mb-4 flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium",
                  days === d ? "bg-white shadow-sm text-ink-900" : "text-ink-600"
                )}
              >
                {d}D
              </button>
            ))}
          </div>

          {rootCause.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rootCause.data && rootCause.data.totals.count > 0 ? (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 mb-4">
                <Card className="p-4">
                  <p className="text-xs text-ink-400">Total wastage</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums text-status-danger">
                    {rootCause.data.totals.qty.toLocaleString("en-IN")} m
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-ink-400">Entries</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums">
                    {rootCause.data.totals.count.toLocaleString("en-IN")}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-ink-400">Penalties</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums">
                    ₹{rootCause.data.totals.penalty.toLocaleString("en-IN")}
                  </p>
                </Card>
              </div>

              {/* AI root-cause analysis */}
              {rootCause.data.aiSummary && (
                <Card className="mb-4 border-l-4 border-brand-500 p-5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
                    <Sparkles className="h-3.5 w-3.5" /> AI root-cause analysis
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-ink-700">{rootCause.data.aiSummary}</p>
                </Card>
              )}

              {/* Rule-based insights */}
              {rootCause.data.insights.length > 0 && (
                <div className="mb-4 space-y-2">
                  {rootCause.data.insights.map((ins, i) => (
                    <Card
                      key={i}
                      className={cn(
                        "flex items-start gap-3 p-3 border-l-4",
                        ins.severity === "warn" ? "border-status-warning" : "border-status-info"
                      )}
                    >
                      {ins.severity === "warn" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-info" />
                      )}
                      <div>
                        <p className="text-sm font-semibold">{ins.title}</p>
                        <p className="text-sm text-ink-600">{ins.detail}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h3 className="font-semibold">Top reasons</h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {rootCause.data.byReason.map((r, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{r.reason}</span>
                        <span className="tabular-nums font-semibold shrink-0">
                          {r.qty.toLocaleString("en-IN")} m
                          <span className="text-ink-400 font-normal"> ({r.count})</span>
                        </span>
                      </li>
                    ))}
                    {rootCause.data.byReason.length === 0 && (
                      <li className="py-3 text-sm text-ink-400">No data</li>
                    )}
                  </ul>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold">Reason × machine hotspots</h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {rootCause.data.reasonMachine.map((h, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {h.reason} <span className="text-ink-400">· {h.machineID}</span>
                        </span>
                        <span className="tabular-nums font-semibold shrink-0">
                          {h.qty.toLocaleString("en-IN")} m
                          <span className="text-ink-400 font-normal"> ({h.count})</span>
                        </span>
                      </li>
                    ))}
                    {rootCause.data.reasonMachine.length === 0 && (
                      <li className="py-3 text-sm text-ink-400">No data</li>
                    )}
                  </ul>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold">By operator</h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {rootCause.data.byOperator.map((o, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {o.name}
                          {o.department && <span className="text-ink-400"> · {o.department}</span>}
                        </span>
                        <span className="tabular-nums font-semibold shrink-0">
                          {o.qty.toLocaleString("en-IN")} m
                          <span className="text-ink-400 font-normal"> ({o.count})</span>
                        </span>
                      </li>
                    ))}
                    {rootCause.data.byOperator.length === 0 && (
                      <li className="py-3 text-sm text-ink-400">No data</li>
                    )}
                  </ul>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold">By machine</h3>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {rootCause.data.byMachine.map((m, i) => (
                      <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                        <span className="min-w-0 truncate">Machine {m.machineID}</span>
                        <span className="tabular-nums font-semibold shrink-0">
                          {m.qty.toLocaleString("en-IN")} m
                          <span className="text-ink-400 font-normal"> ({m.count})</span>
                        </span>
                      </li>
                    ))}
                    {rootCause.data.byMachine.length === 0 && (
                      <li className="py-3 text-sm text-ink-400">No data</li>
                    )}
                  </ul>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <EmptyState title="No wastage in this window" description="Try a longer date range to see root-cause insights." />
            </Card>
          )}
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Record wastage" width="max-w-xl">
        <AddWastageForm onDone={() => setAddOpen(false)} onCancel={() => setAddOpen(false)} />
      </Modal>
    </>
  );
}
