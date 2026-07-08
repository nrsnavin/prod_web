import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeeService } from "./api";
import { EmployeeFormValues } from "./types";

const KEY = "employees";

export function useEmployees(department: string) {
  return useQuery({
    queryKey: [KEY, department],
    queryFn: () => employeeService.list(department),
    placeholderData: (prev) => prev,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: () => employeeService.getById(id!),
    enabled: !!id,
  });
}

export function useEmployeeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY] });

  const create = useMutation({
    mutationFn: (body: EmployeeFormValues) => employeeService.create(body),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<EmployeeFormValues> & { skill?: number } }) =>
      employeeService.update(id, body),
    onSuccess: invalidate,
  });
  const setPerformance = useMutation({
    mutationFn: ({ id, performance }: { id: string; performance: number }) =>
      employeeService.setPerformance(id, performance),
    onSuccess: invalidate,
  });
  return { create, update, setPerformance };
}
