import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareReply } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip, ChipTone } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { feedbackService, FeedbackItem } from "./api";

const statusTone: Record<string, ChipTone> = {
  open: "warning",
  in_review: "info",
  responded: "success",
  closed: "neutral",
};

function RespondModal({ item, onClose }: { item: FeedbackItem; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [response, setResponse] = useState(item.response ?? "");
  const respond = useMutation({
    mutationFn: () => feedbackService.respond(item._id, { response, status: "responded" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  });

  return (
    <FormScreen open onClose={onClose} title="Respond to feedback" width="max-w-md">
      <p className="text-sm text-ink-600 rounded-xl bg-ink-100/60 p-3">
        {item.message ?? item.text ?? ""}
      </p>
      <textarea
        aria-label="Response to feedback"
        rows={4}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Your response…"
        className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!response.trim()}
          loading={respond.isPending}
          onClick={() =>
            respond.mutate(undefined, {
              onSuccess: () => {
                toast("Response sent", "success");
                onClose();
              },
              onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
            })
          }
        >
          Send response
        </Button>
      </div>
    </FormScreen>
  );
}

export function FeedbackPage() {
  const [status, setStatus] = useState("all");
  const [responding, setResponding] = useState<FeedbackItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["feedback", status],
    queryFn: () => feedbackService.list(status),
  });

  return (
    <>
      <PageHeader title="Feedback" subtitle="Worker feedback from the employee app." />

      <div className="mb-4">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "open", label: "Open" },
            { value: "responded", label: "Responded" },
            { value: "closed", label: "Closed" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState title="No feedback" description="Worker submissions appear here." />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((f) => (
            <Card key={f._id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {f.employee?.name ?? "Anonymous"}
                    <span className="ml-2 text-xs font-normal text-ink-400 capitalize">
                      {f.employee?.department ?? ""}
                      {f.category && ` · ${f.category}`}
                      {f.type && ` · ${f.type}`}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-ink-600">{f.message ?? f.text ?? ""}</p>
                  {f.response && (
                    <p className="mt-2 rounded-lg bg-status-successBg px-3 py-2 text-sm">
                      <span className="font-medium">Response:</span> {f.response}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">
                    {f.createdAt && new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip tone={statusTone[f.status] ?? "neutral"}>{f.status}</StatusChip>
                {f.status !== "responded" && f.status !== "closed" && (
                  <Button size="sm" variant="secondary" onClick={() => setResponding(f)}>
                    <MessageSquareReply className="h-4 w-4" /> Respond
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {responding && <RespondModal item={responding} onClose={() => setResponding(null)} />}
    </>
  );
}
