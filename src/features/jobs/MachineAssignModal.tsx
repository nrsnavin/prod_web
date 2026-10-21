import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError, httpClient } from "@/core/http/httpClient";
import { Machine } from "@/features/machines/types";
import { JobDetail } from "./types";
import { useJobMutations } from "./hooks";

function useFreeMachines(enabled: boolean) {
  return useQuery({
    queryKey: ["machines", "free"],
    queryFn: async () => {
      const res = await httpClient.get<{ success: boolean; machines: Machine[] }>("/machine/free");
      return res.machines;
    },
    enabled,
  });
}

// Assign a free machine and map each head to one of the job's planned
// elastics (POST /job/plan-weaving). The machine is claimed either way;
// the job only leaves preparatory if its warping and covering are both
// completed, and the server says which it did.
//
// Also used to MOVE a job that is already weaving — a machine can break
// down mid-run. The machine it was on is freed server-side, inside the
// same transaction as the new claim, so the job is never on neither.
//
// And to change how many heads the job runs on the machine it is already
// on: a wide elastic may fit on only 6 heads of an 8-head loom. Only the
// heads chosen are planned; production is counted per head × those heads,
// and the shifts not yet verified follow the change.
export function MachineAssignModal({
  job,
  open,
  onClose,
}: {
  job: JobDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { planWeaving } = useJobMutations();
  const machines = useFreeMachines(open);
  const [machineId, setMachineId] = useState("");
  const [headMap, setHeadMap] = useState<Record<number, string>>({});
  /** How many of the loom's heads this job runs, from head 1 up. */
  const [headsToRun, setHeadsToRun] = useState(0);
  /**
   * Start in loading: the loom is the job's but weaves nothing yet, and
   * its shifts stay out of production and efficiency until it is marked
   * running on the machine page.
   */
  const [loading, setLoading] = useState(true);
  /**
   * Set when the server refuses because an elastic needs more hooks
   * than the machine has. Holds what it said, so the dialog can name
   * the products rather than asking "are you sure?" about nothing.
   */
  const [hookClash, setHookClash] = useState<{
    machineName: string;
    machineHooks: number;
    elastics: Array<{ name: string; noOfHook: number }>;
  } | null>(null);

  // The machine the job is on is not free, so it is not in that list —
  // offered too, so its heads can be re-planned without moving the job.
  const current = useMemo(
    () => (job.machine
      ? { _id: job.machine.machineId, ID: job.machine.machineName, manufacturer: job.machine.manufacturer ?? "", NoOfHead: job.machine.machineNoOfHead }
      : null),
    [job.machine]
  );
  const options = useMemo(
    () => [
      ...(current ? [current] : []),
      ...(machines.data ?? []).filter((m) => m._id !== current?._id),
    ],
    [machines.data, current]
  );
  const selected = useMemo(() => options.find((m) => m._id === machineId), [options, machineId]);
  const onCurrent = !!current && machineId === current._id;

  /**
   * Send the head map. `confirmHooks` is the second attempt, after the
   * server has said the machine cannot run one of these products as
   * specified and somebody has looked at the list and said go ahead.
   */
  const submit = (confirmHooks: boolean) =>
    planWeaving.mutate(
      {
        jobId: job.id,
        machineId,
        loading,
        // Head 1 up to the number chosen; a head marked Free goes as null
        // — on the plan, not running, nothing counted for it.
        headElasticMap: Object.fromEntries(
          [...Array(headsToRun)].map((_, h) => [String(h), headMap[h] || null])
        ),
        confirmHooks,
      },
      {
        // The machine is claimed either way. Whether the job actually
        // moved to weaving is the server's answer, not an assumption —
        // saying "is now weaving" when it was held in preparatory is
        // how the stage silently disagrees with the screen.
        onSuccess: (res) => {
          setHookClash(null);
          if (res?.weavingHeld) {
            toast(
              `Machine assigned. ${job.jobNo} stays in preparatory — ${res.weavingHeld.blockers.join("; ")}.`,
              "info"
            );
          } else if (onCurrent) {
            toast(`${job.jobNo} now runs ${headsToRun} head${headsToRun === 1 ? "" : "s"} on ${selected?.ID ?? "the machine"}`, "success");
          } else {
            toast(
              `Machine assigned — ${job.jobNo} is now weaving` +
                (loading ? `. ${selected?.ID ?? "The machine"} is loading: mark it running on the machine page when it weaves.` : ""),
              "success"
            );
          }
          onClose();
        },
        onError: (e) => {
          // Not a failure so much as a question. The machine has fewer
          // hooks than one of these products needs, which the floor is
          // sometimes right to go ahead with — so ask, naming what does
          // not fit, rather than reporting an error they cannot act on.
          if (e instanceof ApiError && e.code === "HOOKS_EXCEED_MACHINE") {
            const d = (e.data?.details ?? {}) as {
              machineName?: string;
              machineHooks?: number;
              elastics?: Array<{ name: string; noOfHook: number }>;
            };
            setHookClash({
              machineName:  d.machineName ?? selected?.ID ?? "This machine",
              machineHooks: d.machineHooks ?? 0,
              elastics:     d.elastics ?? [],
            });
            return;
          }
          toast(e instanceof ApiError ? e.message : "Assignment failed", "error");
        },
      }
    );
  const headCount = Math.min(headsToRun, selected?.NoOfHead ?? 0);

  // Not a frozen line: it is complete as it stands, and would take
  // nothing more (services/jobMidRun.js).
  const elasticOptions = job.plannedElastics
    .filter((e) => e.elasticId && !e.frozen)
    .map((e) => ({ value: e.elasticId!, label: e.elasticName }));

  // Spread the job's planned elastics across the given number of heads,
  // round-robin: a single-elastic job fills every head with it; a
  // multi-elastic job distributes them (H1→E1, H2→E2, …, wrapping). Each
  // head stays individually editable afterwards.
  const spreadAcrossHeads = (heads: number): Record<number, string> => {
    const next: Record<number, string> = {};
    for (let h = 0; h < heads; h++) {
      next[h] = elasticOptions.length ? elasticOptions[h % elasticOptions.length].value : "";
    }
    return next;
  };

  const pickMachine = (id: string) => {
    setMachineId(id);
    const m = options.find((x) => x._id === id);
    const all = m?.NoOfHead ?? 0;
    const plan = id === current?._id ? job.machine?.headPlan ?? [] : [];
    // A new machine starts loading; the job's own keeps what it is.
    setLoading(id === current?._id ? !!job.machine?.loading : true);
    if (plan.length) {
      // The job's plan as it stands, free heads included, to adjust.
      setHeadsToRun(Math.min(Math.max(...plan.map((p) => p.head)), all));
      const next = spreadAcrossHeads(all);
      for (const p of plan) next[p.head - 1] = p.elastic ?? "";
      setHeadMap(next);
    } else {
      setHeadsToRun(all);
      setHeadMap(spreadAcrossHeads(all));
    }
  };

  // Heads left Free are fine; at least one has to run.
  const running = [...Array(headCount)].filter((_, h) => headMap[h]).length;
  const allMapped = headCount > 0 && running > 0;

  return (
    <FormScreen
      open={open}
      onClose={onClose}
      title={`${job.machine ? "Change" : "Assign"} machine — ${job.jobNo}`}
      width="max-w-xl"
    >
      {/* Say what happens to the machine it is leaving, so moving a
          running job does not feel like it might strand it. */}
      {job.machine && (
        <p className="mb-3 text-sm text-ink-600">
          {job.jobNo} is on{" "}
          <span className="font-medium">{job.machine.machineName}</span>. Picking another
          moves the job across and frees {job.machine.machineName}.
        </p>
      )}
      <div className="space-y-4">
        <Combobox
          label="Machine *"
          placeholder={machines.isLoading ? "Loading…" : "Select machine"}
          options={options.map((m) => ({
            value: m._id,
            label: `${m.ID} · ${m.manufacturer} · ${m.NoOfHead} heads${m._id === current?._id ? " (current)" : ""}`,
          }))}
          value={machineId}
          onChange={pickMachine}
        />

        {selected && (
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Heads to run"
              value={String(headsToRun)}
              onChange={(e) => setHeadsToRun(Number(e.target.value))}
              options={[...Array(selected.NoOfHead)].map((_, i) => ({
                value: String(selected.NoOfHead - i),
                label: `${selected.NoOfHead - i} of ${selected.NoOfHead}`,
              }))}
              className="w-32"
            />
            <p className="pb-2 text-xs text-ink-400">
              {headsToRun < selected.NoOfHead
                ? `Heads ${headsToRun + 1}–${selected.NoOfHead} stay empty. `
                : ""}
              Mark any head Free below if it is not running. Production is counted on the heads that run.
            </p>
          </div>
        )}

        {selected && (
          <label className="flex items-start gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={loading}
              onChange={(e) => setLoading(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium">Loading</span>
              <span className="block text-xs text-ink-400">
                The loom is being loaded for this job. No production is entered or counted, and
                floor efficiency leaves it out, until you mark it running on the machine.
              </span>
            </span>
          </label>
        )}

        {selected && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-600">
                Head → elastic mapping ({running} running{headCount - running ? ` · ${headCount - running} free` : ""})
              </p>
              {elasticOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setHeadMap(spreadAcrossHeads(headCount))}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Spread elastics evenly
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {[...Array(headCount)].map((_, h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs font-semibold text-ink-400 text-right">
                    H{h + 1}
                  </span>
                  <Select
                    aria-label={`Elastic on head ${h + 1}`}
                    options={[{ value: "", label: "Free" }, ...elasticOptions]}
                    value={headMap[h] ?? ""}
                    onChange={(e) => setHeadMap((m) => ({ ...m, [h]: e.target.value }))}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!machineId || !allMapped}
            loading={planWeaving.isPending}
            onClick={() => submit(false)}
          >
            {onCurrent ? "Save head plan" : job.machine ? "Move to this machine" : "Assign machine"}
          </Button>
        </div>
      </div>

      {/*
        Not an error dialog. The machine has fewer hooks per head than
        one of these products needs, which means it cannot be woven as
        specified — but the floor sometimes runs a product on a smaller
        machine deliberately, so this names what does not fit and lets
        somebody who knows say yes.
      */}
      <ConfirmDialog
        open={!!hookClash}
        title="This machine has too few hooks"
        message={
          hookClash
            ? `${hookClash.machineName} has ${hookClash.machineHooks} hooks per head. ` +
              `${hookClash.elastics
                .map((e) => `${e.name} needs ${e.noOfHook}`)
                .join("; ")}. ` +
              `It cannot be woven as specified on this machine. Assign it anyway?`
            : ""
        }
        confirmLabel="Assign anyway"
        danger
        loading={planWeaving.isPending}
        onCancel={() => setHookClash(null)}
        onConfirm={() => submit(true)}
      />
    </FormScreen>
  );
}
