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
// elastics (POST /job/plan-weaving) — advances preparatory → weaving.
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

  const pickMachine = (id: string) => {
    setMachineId(id);
    // Default every head to the first planned elastic so a single-elastic
    // job needs no per-head clicks.
    const first = elasticOptions[0]?.value ?? "";
    const m = (machines.data ?? []).find((x) => x._id === id);
    const next: Record<number, string> = {};
    for (let h = 0; h < (m?.NoOfHead ?? 0); h++) next[h] = first;
    setHeadMap(next);
  };

  const allMapped = headCount > 0 && [...Array(headCount)].every((_, h) => headMap[h]);

  return (
    <FormScreen open={open} onClose={onClose} title={`Assign machine — ${job.jobNo}`} width="max-w-xl">
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
            <p className="text-sm font-medium text-ink-600 mb-1.5">
              Head → elastic mapping ({headCount} heads)
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {[...Array(headCount)].map((_, h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs font-semibold text-ink-400 text-right">
                    H{h + 1}
                  </span>
                  <Select
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
                  onSuccess: () => {
                    toast(`Machine assigned — ${job.jobNo} is now weaving`, "success");
                    onClose();
                  },
                  onError: (e) =>
                    toast(e instanceof ApiError ? e.message : "Assignment failed", "error"),
                }
              )
            }
          >
            Assign & start weaving
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
