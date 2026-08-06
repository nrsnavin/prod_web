import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, XCircle, Play, RotateCcw,
  MessageSquare, Camera, ImageOff, Flag, PenLine,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { useSample, useSampleMutations } from "./hooks";
import { SamplePhotos } from "./SamplePhotos";
import { SampleStatusChip, STATUS_LABEL, isTerminal, formatWhen, formatQty } from "./sampleShared";
import { SampleLogEntry, SampleStatus } from "./types";

// One sample request and everything that happened to it.
//
// The log is the page. The request itself is a header — it was written
// once and is never edited — and every change since is an entry with its
// author and time, oldest first, because that is the order somebody
// reads it in when they are trying to work out what was promised.

const ENTRY_ICON: Record<SampleLogEntry["kind"], typeof PenLine> = {
  created: Flag,
  update: MessageSquare,
  status: CheckCircle2,
  photo: Camera,
  photo_removed: ImageOff,
};

function entryTitle(e: SampleLogEntry): string {
  switch (e.kind) {
    case "created":
      return "Sample raised";
    case "status":
      return e.fromStatus
        ? `${STATUS_LABEL[e.fromStatus]} → ${STATUS_LABEL[e.status as SampleStatus]}`
        : `Marked ${STATUS_LABEL[e.status as SampleStatus]}`;
    case "photo":
      return "Photo added";
    case "photo_removed":
      return "Photo removed";
    default:
      return "Update";
  }
}

export function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: sample, isLoading, isError, error } = useSample(id);
  const { addLog, setStatus } = useSampleMutations();

  const [note, setNote] = useState("");
  const [pending, setPending] = useState<SampleStatus | null>(null);
  const [reason, setReason] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !sample) {
    return (
      <p className="rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">
        {(error as Error | null)?.message ?? "Sample request not found"}
      </p>
    );
  }

  const ended = isTerminal(sample.status);
  // A terminal move undoes or ends the work, so it is asked to justify
  // itself. Starting work is not a decision anyone needs defending.
  const reasonRequired = pending ? isTerminal(pending) || ended : false;

  const submitStatus = () => {
    if (!pending) return;
    setStatus.mutate(
      { id: sample._id, status: pending, note: reason.trim() },
      {
        onSuccess: () => {
          setPending(null);
          setReason("");
          toast(`Sample marked ${STATUS_LABEL[pending].toLowerCase()}`, "success");
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Could not change the status", "error"),
      }
    );
  };

  const addUpdate = () =>
    addLog.mutate(
      { id: sample._id, note: note.trim() },
      {
        onSuccess: () => {
          setNote("");
          toast("Update added", "success");
        },
        onError: (e) =>
          toast(e instanceof ApiError ? e.message : "Could not add the update", "error"),
      }
    );

  return (
    <>
      <Link
        to="/samples"
        className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Sample Requests
      </Link>

      <PageHeader
        title={`S-${sample.sampleNo} — ${sample.title}`}
        subtitle={sample.customerName || "No customer named"}
        actions={
          isAdmin ? (
            <>
              {sample.status === "open" && (
                <Button variant="secondary" onClick={() => setPending("in_progress")}>
                  <Play className="h-4 w-4" /> Start work
                </Button>
              )}
              {!ended && (
                <>
                  <Button onClick={() => setPending("completed")}>
                    <CheckCircle2 className="h-4 w-4" /> Mark completed
                  </Button>
                  <Button variant="danger" onClick={() => setPending("closed")}>
                    <XCircle className="h-4 w-4" /> Close
                  </Button>
                </>
              )}
              {ended && (
                <Button variant="secondary" onClick={() => setPending("in_progress")}>
                  <RotateCcw className="h-4 w-4" /> Reopen
                </Button>
              )}
            </>
          ) : null
        }
      />

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <SampleStatusChip status={sample.status} />
          {ended && sample.closedAt && (
            <span className="text-sm text-ink-400">on {formatWhen(sample.closedAt)}</span>
          )}
        </div>
        <DescriptionList
          columns={3}
          items={[
            { label: "Raised by", value: sample.raisedByName || undefined },
            { label: "Raised on", value: formatWhen(sample.createdAt) },
            {
              label: "Quantity",
              value: sample.quantity > 0 ? `${formatQty(sample.quantity)} m` : undefined,
            },
            {
              label: "Wanted by",
              value: sample.targetDate
                ? new Date(sample.targetDate).toLocaleDateString()
                : undefined,
            },
            { label: "Priority", value: sample.priority },
          ]}
        />
        <div className="mt-4 border-t border-ink-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            What was asked for
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{sample.details}</p>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h3 className="font-semibold">Log</h3>

          <ol className="mt-3 space-y-4">
            {sample.log.map((e) => {
              const Icon = ENTRY_ICON[e.kind] ?? MessageSquare;
              return (
                <li key={e._id} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entryTitle(e)}</p>
                    {e.note && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-600">{e.note}</p>
                    )}
                    <p className="mt-0.5 text-xs text-ink-400">
                      {e.byName || "—"} · {formatWhen(e.at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 border-t border-ink-100 pt-4">
            {ended ? (
              <p className="text-sm text-ink-400">
                This sample is {STATUS_LABEL[sample.status].toLowerCase()}. An admin can reopen it
                to add more.
              </p>
            ) : (
              <>
                <label
                  htmlFor="sample-update"
                  className="mb-1.5 block text-sm font-medium text-ink-600"
                >
                  Add an update
                </label>
                <textarea
                  id="sample-update"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Warped 60 m on loom 4. Shade a touch light against the card."
                  className="w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    disabled={note.trim().length === 0}
                    loading={addLog.isPending}
                    onClick={addUpdate}
                  >
                    <PenLine className="h-4 w-4" /> Add to log
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        <SamplePhotos sample={sample} canAdd={!ended} />
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `Mark this sample ${STATUS_LABEL[pending].toLowerCase()}?` : ""}
        width="max-w-md"
      >
        <p className="text-sm text-ink-600">
          {pending && isTerminal(pending)
            ? "It stops taking updates and photos until an admin reopens it. Your reason goes into the log."
            : ended
              ? "Reopening undoes a decision somebody made — say why, and it goes into the log."
              : "This goes into the log against your name."}
        </p>
        <div className="mt-3">
          <Input
            label={reasonRequired ? "Why?" : "Note (optional)"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              pending === "completed"
                ? "e.g. Approved by the customer, 50 m dispatched"
                : pending === "closed"
                  ? "e.g. Customer went elsewhere"
                  : "e.g. Customer came back asking for a wider version"
            }
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            variant={pending === "closed" ? "danger" : "primary"}
            disabled={reasonRequired && reason.trim().length === 0}
            loading={setStatus.isPending}
            onClick={submitStatus}
          >
            {pending ? STATUS_LABEL[pending] : ""}
          </Button>
        </div>
      </Modal>
    </>
  );
}
