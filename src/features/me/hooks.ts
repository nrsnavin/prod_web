import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { meService } from "./api";

// Query keys are registered in app/queryPolicy.ts: today's shift is
// live (a supervisor may verify it or change the loom at any moment),
// pay and the elastic recipe never poll.

export function useMyToday() {
  return useQuery({ queryKey: ["my-today"], queryFn: meService.today });
}

export function useMyPerformance(days: number) {
  return useQuery({
    queryKey: ["my-performance", days],
    queryFn: () => meService.performance(days),
    placeholderData: (prev) => prev,
  });
}

export function useMyElastic(id: string | undefined) {
  return useQuery({ queryKey: ["my-elastic", id], queryFn: () => meService.elastic(id!), enabled: !!id });
}

export function useMyProfile(enabled = true) {
  return useQuery({ queryKey: ["my-profile"], queryFn: meService.profile, enabled });
}

/** The logged-in worker's employee id, for the self-service routes. */
export function useMyEmployeeId(): string | null {
  return useAuth().user?.employeeId ?? null;
}

export function useMyWastage() {
  const id = useMyEmployeeId();
  return useQuery({ queryKey: ["my-wastage", id], queryFn: () => meService.wastage(id!), enabled: !!id });
}

export function useMyAttendance(year: number, month: number) {
  const id = useMyEmployeeId();
  return useQuery({
    queryKey: ["my-attendance", id, year, month],
    queryFn: () => meService.attendanceMonth(id!, year, month),
    enabled: !!id,
  });
}

export function useMyLeaves() {
  const id = useMyEmployeeId();
  return useQuery({ queryKey: ["my-leaves", id], queryFn: () => meService.leaves(id!), enabled: !!id });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => meService.cancelLeave(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-leaves"] }),
  });
}

export function useMyPayslip(year: number, month: number) {
  const id = useMyEmployeeId();
  return useQuery({
    queryKey: ["my-payslip", id, year, month],
    queryFn: () => meService.payslip(id!, year, month),
    enabled: !!id,
  });
}

export function useSubmitProduction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { shiftId: string; production: number; timer?: string; feedback?: string }) =>
      meService.submitProduction(v.shiftId, { production: v.production, timer: v.timer, feedback: v.feedback }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-today"] }),
  });
}
