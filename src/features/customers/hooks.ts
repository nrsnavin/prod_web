import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "./api";
import { CustomerFormValues } from "./types";

const KEY = "customers";

export function useCustomers(params: { page: number; search: string }) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => customerService.list({ ...params, limit: 20 }),
    placeholderData: (prev) => prev,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => customerService.getById(id!),
    enabled: !!id,
  });
}

export function useCustomerMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: CustomerFormValues) => customerService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CustomerFormValues }) =>
      customerService.update(id, body),
    onSuccess: invalidate,
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => customerService.deactivate(id),
    onSuccess: invalidate,
  });
  return { create, update, deactivate };
}
