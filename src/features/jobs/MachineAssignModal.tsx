import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
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

  const selected = useMemo(
    () => (machines.data ?? []).find((m) => m._id === machineId),
    [machines.data, machineId]
  );
  const headCount = selected?.NoOfHead ?? 0;

  const elasticOptions = job.plannedElastics
    .filter((e) => e.elasticId)
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
    const m = (machines.data ?? []).find((x) => x._id === id);
    setHeadMap(spreadAcrossHeads(m?.NoOfHead ?? 0));
  };

  const allMapped = headCount > 0 && [...Array(headCount)].every((_, h) => headMap[h]);

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
          label="Free machine *"
          placeholder={machines.isLoading ? "Loading…" : "Select machine"}
          options={(machines.data ?? []).map((m) => ({
            value: m._id,
            label: `${m.ID} · ${m.manufacturer} · ${m.NoOfHead} heads`,
          }))}
          value={machineId}
          onChange={pickMachine}
        />

        {selected && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-600">
                Head → elastic mapping ({headCount} heads)
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
                    aria-label={`Elastic on head ${h}`}
                    options={elasticOptions}
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
            onClick={() =>
              planWeaving.mutate(
                {
                  jobId: job.id,
                  machineId,
                  headElasticMap: Object.fromEntries(
                    Object.entries(headMap).map(([k, v]) => [String(k), v])
                  ),
                },
                {
                  // The machine is claimed either way. Whether the job
                  // actually moved to weaving is the server's answer,
                  // not an assumption — saying "is now weaving" when it
                  // was held in preparatory is how the stage silently
                  // disagrees with the screen.
                  onSuccess: (res) => {
                    if (res?.weavingHeld) {
                      toast(
                        `Machine assigned. ${job.jobNo} stays in preparatory — ${res.weavingHeld.blockers.join("; ")}.`,
                        "info"
                      );
                    } else {
                      toast(`Machine assigned — ${job.jobNo} is now weaving`, "success");
                    }
                    onClose();
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Assignment failed", "error"),
                }
              )
            }
          >
            {job.machine ? "Move to this machine" : "Assign machine"}
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
