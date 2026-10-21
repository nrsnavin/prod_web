import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dispatchService } from "./api";
import { Urgency } from "./types";

const KEY = "dispatch";

/** Polled: items join as jobs reach packing on the floor, and deadlines pass. */
export function useDispatchQueue(view: "open" | "dispatched") {
  return useQuery({
    queryKey: [KEY, view],
    queryFn: () => dispatchService.queue(view),
    refetchInterval: view === "open" ? 30_000 : false,
    placeholderData: (prev) => prev,
  });
}

export function useDispatchMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });
  return {
    setUrgency: useMutation({
      mutationFn: ({ id, urgency }: { id: string; urgency: Urgency }) => dispatchService.setUrgency(id, urgency),
      onSuccess: invalidate,
    }),
    markDispatched: useMutation({
      mutationFn: ({ id, note }: { id: string; note: string }) => dispatchService.markDispatched(id, note),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => dispatchService.remove(id, reason),
      onSuccess: invalidate,
    }),
  };
}
