import { useMemo, useState } from "react";
import { FormScreen } from "@/components/ui/FormScreen";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useJob } from "@/features/jobs/hooks";
import { useMachineMutations } from "./hooks";
import { MachineHeadElastic } from "./types";

// Edit which of the running job's elastics is threaded on each head.
// Heads are 1-based to match how plan-weaving stores them.
export function MachineHeadMapEditModal({
  machineId,
  heads,
  current,
  jobId,
  onClose,
}: {
  machineId: string;
  heads: number;
  current: MachineHeadElastic[];
  jobId: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { updateElasticMap } = useMachineMutations();
  const job = useJob(jobId ?? undefined);

  // Options come from the running job's planned elastics; fall back to
  // whatever is already threaded so current values stay selectable.
  const options = useMemo(() => {
    const fromJob = (job.data?.plannedElastics ?? [])
      .filter((e) => e.elasticId)
      .map((e) => ({ value: e.elasticId as string, label: e.elasticName }));
    if (fromJob.length) return fromJob;
    const seen = new Map<string, string>();
    for (const h of current) if (h.elastic?._id) seen.set(h.elastic._id, h.elastic.name ?? "Elastic");
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [job.data, current]);

  const [headMap, setHeadMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const h of current) if (h.head != null) map[h.head] = h.elastic?._id ?? "";
    return map;
  });

  const spread = () => {
    const next: Record<number, string> = {};
    for (let h = 1; h <= heads; h++) {
      next[h] = options.length ? options[(h - 1) % options.length].value : "";
    }
    setHeadMap(next);
  };

  const save = () => {
    const elastics = Array.from({ length: heads }, (_, i) => ({
      head: i + 1,
      elastic: headMap[i + 1] || null,
    }));
    updateElasticMap.mutate(
      { id: machineId, elastics },
      {
        onSuccess: () => {
          toast("Head → elastic map updated", "success");
          onClose();
        },
        onError: (e) => toast(e instanceof ApiError ? e.message : "Update failed", "error"),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title="Edit head → elastic map" width="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-600">{heads} heads</p>
          {options.length > 1 && (
            <button
              type="button"
              onClick={spread}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Spread elastics evenly
            </button>
          )}
        </div>

        {options.length === 0 ? (
          <p className="text-sm text-ink-400">
            No elastics available to assign{jobId ? "" : " — no job is running on this machine"}.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
            {Array.from({ length: heads }, (_, i) => {
              const h = i + 1;
              return (
                <div key={h} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs font-semibold text-ink-400 text-right">H{h}</span>
                  <Select
                    options={[{ value: "", label: "— none —" }, ...options]}
                    value={headMap[h] ?? ""}
                    onChange={(e) => setHeadMap((m) => ({ ...m, [h]: e.target.value }))}
                    className="h-9"
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={updateElasticMap.isPending} disabled={options.length === 0} onClick={save}>
            Save map
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
