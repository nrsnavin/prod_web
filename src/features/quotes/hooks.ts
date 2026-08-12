import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteService } from "./api";
import { QuoteStatus, QuoteWriteBody } from "./types";

const KEY = "quotes";

export function useQuotes(params: { page: number; status: QuoteStatus | "all"; search: string }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => quoteService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => quoteService.getById(id!),
    enabled: !!id,
  });
}

export function useQuoteMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: QuoteWriteBody) => quoteService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, auditReason, body }: { id: string; auditReason: string; body: Partial<QuoteWriteBody> }) =>
      quoteService.update(id, auditReason, body),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatus }) =>
      quoteService.setStatus(id, status),
    onSuccess: invalidate,
  });

  return { create, update, setStatus };
}
