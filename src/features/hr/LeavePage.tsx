import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, CalendarOff } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { leaveService } from "./api";

export function LeavePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["leave", "pending"],
    queryFn: leaveService.pending,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leave"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const approve = useMutation({
    mutationFn: (id: string) => leaveService.approve(id),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (id: string) => leaveService.reject(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <PageHeader
        title="Leave requests"
        subtitle="Pending requests from the employee app. Approved leave feeds attendance."
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarOff className="h-12 w-12" />}
            title="No pending leave requests"
            description="New requests from workers appear here for approval."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((l) => {
            const id = l._id ?? l.id ?? "";
            return (
              <Card key={id} className="p-4 flex flex-wrap items-center gap-4">
                <span className="h-10 w-10 rounded-full bg-brand-100 text-brand-600 grid place-items-center font-bold uppercase">
                  {l.employee?.name?.charAt(0) ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.employee?.name ?? "—"}</p>
                  <p className="text-xs text-ink-400 capitalize">
                    {l.employee?.department ?? ""}
                    {l.type && ` · ${l.type}`}
                  </p>
                  {l.reason && <p className="mt-1 text-sm text-ink-600">{l.reason}</p>}
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">
                    {l.date ? new Date(l.date).toLocaleDateString() : "—"}
                    {l.toDate && ` → ${new Date(l.toDate).toLocaleDateString()}`}
                  </p>
                  {l.createdAt && (
                    <p className="text-xs text-ink-400">
                      requested {new Date(l.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    loading={approve.isPending}
                    onClick={() =>
                      approve.mutate(id, {
                        onSuccess: () => toast("Leave approved", "success"),
                        onError: (e) =>
                          toast(e instanceof ApiError ? e.message : "Failed", "error"),
                      })
                    }
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={reject.isPending}
                    onClick={() =>
                      reject.mutate(id, {
                        onSuccess: () => toast("Leave rejected", "success"),
                        onError: (e) =>
                          toast(e instanceof ApiError ? e.message : "Failed", "error"),
                      })
                    }
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </span>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
