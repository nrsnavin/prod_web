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
import { feedbackService, FeedbackItem, FEEDBACK_STATUSES } from "./api";
import { formatDate } from "@/core/format/date";
import { useAuth } from "@/core/auth/useAuth";
import { FeedbackThemes } from "./FeedbackThemes";
import { Select } from "@/components/ui/Select";

// The statuses a note really has. This page used to know "responded",
// which is not one: its reply was refused every time, and its
// "Responded" filter listed nothing.
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
  rejected: "Rejected",
  closed: "Closed",
};
const statusTone: Record<string, ChipTone> = {
  open: "warning",
  in_review: "info",
  resolved: "success",
  rejected: "danger",
  closed: "neutral",
};

/** Who wrote it: "Anonymous" only for a note sent that way. */
const authorOf = (f: FeedbackItem) => (f.isAnonymous ? "Anonymous" : f.employee?.name ?? "Unknown employee");

/** What the worker wrote: the subject, then what they said. */
function TheNote({ item }: { item: FeedbackItem }) {
  return (
    <>
      {item.subject && <p className="mt-1 text-sm font-medium text-ink-900">{item.subject}</p>}
      {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{item.body}</p>}
    </>
  );
}

function RespondModal({ item, onClose }: { item: FeedbackItem; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [response, setResponse] = useState(item.response ?? "");
  // A reply to a note still open settles it unless the admin says it is
  // only being looked into; a note already moved on keeps its status.
  const [status, setStatus] = useState(item.status === "open" ? "resolved" : item.status);
  // The reply is sent when it was changed. Left as it was, the request
  // says nothing of it and the server keeps it, and who gave it.
  const changed = response.trim() !== (item.response ?? "").trim();
  const respond = useMutation({
    mutationFn: () => feedbackService.respond(item._id, { response: changed ? response.trim() : undefined, status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback"] }),
  });

  return (
    <FormScreen open onClose={onClose} title="Respond to feedback" width="max-w-md">
      <div className="rounded-xl bg-ink-100/60 p-3">
        <p className="text-xs text-ink-500">{authorOf(item)}</p>
        <TheNote item={item} />
      </div>
      <textarea
        aria-label="Response to feedback"
        rows={4}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Your response…"
        className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      />
      <div className="mt-3">
        <Select
          label="Status"
          options={FEEDBACK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </div>
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
  const isAdmin = useAuth().user?.role === "admin";
  const [status, setStatus] = useState("all");
  const [responding, setResponding] = useState<FeedbackItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["feedback", status],
    queryFn: () => feedbackService.list(status),
    // The inbox is the admin's; anyone else is told so, not shown an error.
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Feedback" subtitle="Worker feedback from the employee app." />
        <Card><EmptyState title="Only an admin answers feedback" description="Workers send it from the employee app; an admin reads and replies here." /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Feedback" subtitle="Worker feedback from the employee app." />

      <FeedbackThemes />

      <div className="mb-4">
        <FilterChips
          options={[{ value: "all", label: "All" }, ...FEEDBACK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
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
                    <span>{authorOf(f)}</span>
                    <span className="ml-2 text-xs font-normal text-ink-400 capitalize">
                      {[f.isAnonymous ? "" : f.employee?.department, f.category, f.type].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                  {/* What they wrote. (The card used to read fields the server never sends, and showed nothing.) */}
                  <TheNote item={f} />
                  {f.response && (
                    <div className="mt-2 rounded-lg bg-status-successBg px-3 py-2 text-sm">
                      <p className="whitespace-pre-wrap">{f.response}</p>
                      {(f.respondedBy?.name || f.respondedAt) && (
                        <p className="mt-1 text-xs text-ink-500">
                          {[f.respondedBy?.name, f.respondedAt ? formatDate(f.respondedAt) : ""].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-ink-400">
                    {f.createdAt && formatDate(f.createdAt)}
                  </p>
                </div>
                <StatusChip tone={statusTone[f.status] ?? "neutral"}>{(STATUS_LABEL[f.status] ?? f.status).toLowerCase()}</StatusChip>
                {f.status !== "closed" && (
                  <Button size="sm" variant="secondary" onClick={() => setResponding(f)}>
                    <MessageSquareReply className="h-4 w-4" /> {f.response ? "Update reply" : "Respond"}
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
