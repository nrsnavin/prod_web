import { useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, CheckCircle2, Clock, PackageCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FilterChips } from "@/components/ui/FilterChips";
import { StatusChip } from "@/components/ui/StatusChip";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ReasonDialog } from "@/components/ui/ReasonDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/core/http/httpClient";
import { useAuth } from "@/core/auth/useAuth";
import { useDispatchMutations, useDispatchQueue } from "./hooks";
import { DispatchItem, URGENCY_OPTIONS, Urgency } from "./types";
import { URGENCY_TONE, dueText, span } from "./dispatchFormat";

// ══════════════════════════════════════════════════════════════════
//  WHAT IS WAITING TO LEAVE, MOST URGENT FIRST
//
//  A job reaching packing, or a finished sample, lands here and waits for
//  marketing / admin to say when the customer needs it. Until then it sits
//  at the top under "Needs a delivery urgency" — it cannot be placed in the
//  queue without that answer. After it, the queue in deadline order, with
//  anything past its deadline marked late.
// ══════════════════════════════════════════════════════════════════

const linkOf = (i: DispatchItem) =>
  i.kind === "job" && i.job ? `/jobs/${i.job}` : i.kind === "sample" && i.sample ? `/samples/${i.sample}` : null;

function What({ item }: { item: DispatchItem }) {
  const to = linkOf(item);
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2">
        {to ? (
          <Link to={to} className="font-semibold text-brand-600 hover:underline">{item.ref}</Link>
        ) : (
          <span className="font-semibold">{item.ref}</span>
        )}
        <span className="truncate font-medium">{item.customerName || "—"}</span>
        {item.kind === "sample" && <StatusChip tone="neutral">Sample</StatusChip>}
      </p>
      <p className="truncate text-sm text-ink-500">
        {item.title || "—"}
        {item.quantity > 0 && <span className="tabular-nums"> · {item.quantity.toLocaleString("en-IN")} m</span>}
        {item.orderNo != null && <span> · Order #{item.orderNo}</span>}
      </p>
    </div>
  );
}

function UrgencyButtons({ item, onPick, busy }: { item: DispatchItem; onPick: (u: Urgency) => void; busy: boolean }) {
  return (
    <div role="group" aria-label={`Delivery urgency for ${item.ref}`} className="flex flex-wrap gap-1.5">
      {URGENCY_OPTIONS.map((o) => (
        <Button key={o.value} size="sm" variant="secondary" disabled={busy} onClick={() => onPick(o.value)} title={o.hint}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export function DispatchQueuePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canSetUrgency = user?.role === "admin" || user?.role === "marketing";
  const canRemove = user?.role === "admin";

  const [view, setView] = useState<"open" | "dispatched">("open");
  const { data, isLoading, isError, error } = useDispatchQueue(view);
  const { setUrgency, markDispatched, remove } = useDispatchMutations();
  const [sending, setSending] = useState<DispatchItem | null>(null);
  const [sendNote, setSendNote] = useState("");
  const [removing, setRemoving] = useState<DispatchItem | null>(null);

  const now = new Date();
  const items = data?.items ?? [];
  const awaiting = items.filter((i) => i.status === "awaiting_urgency");
  const queued = items.filter((i) => i.status === "queued");

  const fail = (e: unknown, what: string) => toast(e instanceof ApiError ? e.message : what, "error");
  const pick = (item: DispatchItem, urgency: Urgency) =>
    setUrgency.mutate({ id: item._id, urgency }, {
      onSuccess: (r) => toast(`${item.ref}: ${r.urgencyLabel}`, "success"),
      onError: (e) => fail(e, "Could not set the urgency"),
    });

  const counts = data?.counts;
  const subtitle = view === "dispatched"
    ? "Most recently dispatched"
    : counts
      ? [
          counts.awaiting && `${counts.awaiting} need an urgency`,
          `${counts.queued} in the queue`,
          counts.late && `${counts.late} late`,
        ].filter(Boolean).join(" · ")
      : undefined;

  return (
    <>
      <PageHeader title="Dispatch" subtitle={subtitle} />

      <div className="mb-4">
        <FilterChips
          options={[{ value: "open", label: "Queue" }, { value: "dispatched", label: "Dispatched" }]}
          value={view}
          onChange={(v) => setView(v as "open" | "dispatched")}
        />
      </div>

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : view === "dispatched" ? (
        <Card>
          {items.length === 0 ? (
            <EmptyState title="Nothing dispatched yet" description="Items marked dispatched from the queue appear here." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((i) => (
                <li key={i._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <What item={i} />
                  <div className="text-right text-sm">
                    <p className="inline-flex items-center gap-1.5 text-status-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {i.dispatchedAt ? new Date(i.dispatchedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                    </p>
                    <p className="text-xs text-ink-400">
                      {i.dispatchedByName && `by ${i.dispatchedByName}`}
                      {i.dispatchNote && ` · ${i.dispatchNote}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="space-y-5">
          {awaiting.length > 0 && (
            <section aria-labelledby="awaiting-h">
              <h2 id="awaiting-h" className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <AlarmClock className="h-4 w-4 text-status-warning" aria-hidden />
                Needs a delivery urgency
                <span className="font-normal text-ink-400">
                  {canSetUrgency ? "— when does the customer need it?" : "— waiting for marketing or admin"}
                </span>
              </h2>
              <Card className="border-l-4 border-status-warning">
                <ul className="divide-y divide-ink-100">
                  {awaiting.map((i) => (
                    <li key={i._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <What item={i} />
                        <p className="mt-0.5 text-xs text-ink-400">Ready {span(now.getTime() - new Date(i.readyAt).getTime())} ago</p>
                      </div>
                      {canSetUrgency ? (
                        <UrgencyButtons item={i} busy={setUrgency.isPending} onPick={(u) => pick(i, u)} />
                      ) : (
                        <StatusChip tone="warning">Awaiting urgency</StatusChip>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          <section aria-labelledby="queue-h">
            <h2 id="queue-h" className="mb-2 text-sm font-semibold">Dispatch queue</h2>
            <Card>
              {queued.length === 0 ? (
                <EmptyState
                  title={awaiting.length ? "Nothing placed yet" : "Nothing waiting to go"}
                  description={awaiting.length
                    ? "Items join the queue once their delivery urgency is set."
                    : "Jobs join when they reach packing; samples when they are completed."}
                />
              ) : (
                <ol className="divide-y divide-ink-100">
                  {queued.map((i, n) => (
                    <li key={i._id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i.late && "bg-status-dangerBg/30")}>
                      <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-400" aria-label={`Position ${n + 1}`}>
                        {n + 1}
                      </span>
                      <div className="min-w-0 flex-1"><What item={i} /></div>
                      <div className="text-right text-sm">
                        <p className="flex items-center justify-end gap-2">
                          {i.urgency && <StatusChip tone={URGENCY_TONE[i.urgency]}>{i.urgencyLabel}</StatusChip>}
                          {i.late && <StatusChip tone="danger">Late {span(now.getTime() - new Date(i.dueAt!).getTime())}</StatusChip>}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
                          <Clock className="h-3 w-3" aria-hidden />
                          {i.dueAt ? dueText(i.dueAt, now) : "—"}
                          {i.urgencySetByName && <span className="text-ink-400"> · set by {i.urgencySetByName}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="sm" onClick={() => { setSending(i); setSendNote(""); }}>
                          <PackageCheck className="h-4 w-4" /> Dispatched
                        </Button>
                        <ActionMenu
                          label="More"
                          items={[
                            ...(canSetUrgency ? URGENCY_OPTIONS.filter((o) => o.value !== i.urgency).map((o) => ({
                              label: `Change to ${o.label}`, hint: o.hint, onSelect: () => pick(i, o.value),
                            })) : []),
                            ...(canRemove ? [{
                              label: "Remove from queue…", icon: <Trash2 className="h-4 w-4" />, onSelect: () => setRemoving(i),
                            }] : []),
                          ]}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>
        </div>
      )}

      {sending && (
        <Modal open onClose={() => setSending(null)} title={`Mark ${sending.ref} dispatched`} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-ink-500">{sending.customerName}{sending.title && ` — ${sending.title}`}</p>
            <Input
              label="Note (optional)"
              placeholder="e.g. DC-41, lorry TN38 AB 1234"
              value={sendNote}
              onChange={(e) => setSendNote(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSending(null)} disabled={markDispatched.isPending}>Cancel</Button>
              <Button
                loading={markDispatched.isPending}
                onClick={() => markDispatched.mutate({ id: sending._id, note: sendNote.trim() }, {
                  onSuccess: () => { toast(`${sending.ref} dispatched`, "success"); setSending(null); },
                  onError: (e) => fail(e, "Could not mark it dispatched"),
                })}
              >
                Mark dispatched
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ReasonDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.ref ?? ""} from the dispatch queue`}
        description="It will not be dispatched from here. Recorded with the reason."
        confirmLabel="Remove"
        tone="danger"
        loading={remove.isPending}
        onConfirm={(reason) => removing && remove.mutate({ id: removing._id, reason }, {
          onSuccess: () => { toast(`${removing.ref} removed from the queue`, "success"); setRemoving(null); },
          onError: (e) => fail(e, "Could not remove it"),
        })}
      />
    </>
  );
}

export default DispatchQueuePage;
