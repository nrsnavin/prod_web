import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qcService } from "./api";
import { QcCreateBody } from "./types";

const KEY = "qc";

export function useQcJobs() {
  return useQuery({ queryKey: [KEY, "jobs"], queryFn: qcService.jobsForQc });
}

export function useQcRecent() {
  return useQuery({ queryKey: [KEY, "recent"], queryFn: () => qcService.recent(30) });
}

export function useQcMutations() {
  const qc = useQueryClient();
  const visionDraft = useMutation({
    mutationFn: ({ elasticId, file }: { elasticId: string; file: File }) =>
      qcService.visionDraft(elasticId, file),
  });
  const create = useMutation({
    mutationFn: (body: QcCreateBody) => qcService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
  return { visionDraft, create };
}
