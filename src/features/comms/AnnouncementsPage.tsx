import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { formResolver } from "@/core/forms/formResolver";
import { Plus, Pin, Trash2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/core/auth/useAuth";
import { NoticeTranslations } from "./NoticeTranslations";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { Announcement } from "@/features/dashboard/api";
import { announcementService, AnnouncementFormValues } from "./api";
import { formatDate, todayYmd, ymd } from "@/core/format/date";
import { cn } from "@/components/ui/cn";

/** The kinds of notice the server has (api/announcement.js). */
export const NOTICE_TYPES = ["info", "warning", "safety", "policy", "celebration"] as const;

/**
 * Where a notice stands: removed, expired, not yet up, or up.
 *
 * An admin is sent every notice, removed and expired ones included, and
 * the list drew them all alike — a deleted notice stayed, looking live.
 * "Valid until" is the last day it is up, so it is expired from the day
 * after; the day is read off the moment as this device sees it, which
 * reads rightly both the day the server keeps and the instant the phone
 * used to send.
 */
export function noticeState(a: Announcement, today = todayYmd()): "removed" | "expired" | "scheduled" | "live" {
  if (a.isActive === false) return "removed";
  if (a.validUntil) {
    const until = new Date(a.validUntil);
    if (!Number.isNaN(until.getTime()) && ymd(until) < today) return "expired";
  }
  if (a.validFrom) {
    const from = new Date(a.validFrom);
    if (!Number.isNaN(from.getTime()) && from.getTime() > Date.now()) return "scheduled";
  }
  return "live";
}
const STATE_LABEL = { removed: "removed", expired: "expired", scheduled: "not up yet" } as const;

const schema = z.object({
  title: z.string().min(1, "Title required"),
  body: z.string().min(1, "Body required"),
  type: z.string().optional(),
  audience: z.enum(["all", "department"]),
  department: z.string().optional(),
  isPinned: z.boolean().optional(),
  validUntil: z.string().optional(),
});

function AnnouncementForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (v: AnnouncementFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AnnouncementFormValues>({
    resolver: formResolver<AnnouncementFormValues>(schema),
    defaultValues: { title: "", body: "", type: "info", audience: "all", isPinned: false },
  });
  const audience = watch("audience");
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Title *" error={errors.title?.message} {...register("title")} />
      <div>
        <label className="block text-sm font-medium text-ink-600 mb-1.5">Message *</label>
        <textarea
          aria-label="Announcement text"
          rows={4}
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          {...register("body")}
        />
        {errors.body && <p className="text-xs text-status-danger mt-1">{errors.body.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* The server's kinds. This list used to offer "urgent", which it refuses, and no "safety". */}
        <Select
          label="Type"
          options={NOTICE_TYPES.map((t) => ({ value: t, label: t }))}
          {...register("type")}
        />
        <Select
          label="Audience"
          options={[
            { value: "all", label: "Everyone" },
            { value: "department", label: "One department" },
          ]}
          {...register("audience")}
        />
        {audience === "department" && (
          <Input label="Department" placeholder="e.g. weaving" {...register("department")} />
        )}
        {/* For any audience: the department box used to take this one's place. */}
        <Input label="Valid until" type="date" hint="Up through this day. Leave empty for no end." {...register("validUntil")} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-brand-500" {...register("isPinned")} />
        Pin to top
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>Post announcement</Button>
      </div>
    </form>
  );
}

export function AnnouncementsPage() {
  // Everyone reads what is up for them; only an admin posts, pins or removes.
  const isAdmin = useAuth().user?.role === "admin";
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["announcements", "admin"],
    queryFn: announcementService.list,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const create = useMutation({ mutationFn: announcementService.create, onSuccess: invalidate });
  const remove = useMutation({ mutationFn: announcementService.remove, onSuccess: invalidate });
  const togglePin = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      announcementService.update(id, { isPinned }),
    onSuccess: invalidate,
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not change the pin", "error"),
  });
  // A removed notice is kept, and can be put back up.
  const restore = useMutation({
    mutationFn: (id: string) => announcementService.update(id, { isActive: true }),
    onSuccess: () => { invalidate(); toast("Back on the notice board", "success"); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not restore it", "error"),
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={isAdmin ? "Broadcast to the employee app's notice board." : "What is on the notice board for you now."}
        actions={isAdmin ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        ) : undefined}
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState title="No announcements" description={isAdmin ? "Post one to reach the floor." : "Nothing on the notice board right now."} />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((a) => {
            const state = noticeState(a);
            const removed = state === "removed";
            return (
            <Card key={a._id} data-notice className={cn("p-4", state !== "live" && "opacity-70")}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold flex flex-wrap items-center gap-2">
                    {a.isPinned && <Pin className="h-3.5 w-3.5 text-brand-500" />}
                    <span>{a.title}</span>
                    {/* Not on the board: said so, so a deleted notice no longer looks live. */}
                    {state !== "live" && <StatusChip tone={state === "scheduled" ? "info" : "neutral"}>{STATE_LABEL[state]}</StatusChip>}
                    {a.type && a.type !== "info" && (
                      <StatusChip tone={a.type === "safety" || a.type === "warning" ? "warning" : "info"}>{a.type}</StatusChip>
                    )}
                    {a.audience === "department" && (
                      <StatusChip tone="info">{a.department}</StatusChip>
                    )}
                  </p>
                  {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{a.body}</p>}
                  <p className="mt-1 text-xs text-ink-400">
                    {[a.createdAt ? formatDate(a.createdAt) : "", a.validUntil ? `Until ${formatDate(ymd(new Date(a.validUntil)))}` : ""].filter(Boolean).join(" · ")}
                  </p>
                  {isAdmin && !removed && <NoticeTranslations id={a._id} translations={a.translations} />}
                </div>
                {isAdmin && removed && (
                  <Button size="sm" variant="secondary" loading={restore.isPending && restore.variables === a._id} onClick={() => restore.mutate(a._id)}>
                    <RotateCcw className="h-4 w-4" /> Restore
                  </Button>
                )}
                {isAdmin && !removed && (<>
                <button
                  onClick={() => togglePin.mutate({ id: a._id, isPinned: !a.isPinned })}
                  className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-brand-600"
                  title={a.isPinned ? "Unpin" : "Pin"}
                >
                  <Pin className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleting(a)}
                  className="p-1.5 rounded-lg text-ink-400 hover:bg-status-dangerBg hover:text-status-danger"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                </>)}
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <FormScreen open={createOpen} onClose={() => setCreateOpen(false)} title="New announcement" width="max-w-xl">
        <AnnouncementForm
          submitting={create.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            create.mutate(values, {
              onSuccess: () => {
                setCreateOpen(false);
                toast("Announcement posted", "success");
              },
              onError: (e) =>
                toast(e instanceof ApiError ? e.message : "Failed to post", "error"),
            })
          }
        />
      </FormScreen>

      <ConfirmDialog
        open={!!deleting}
        title="Take this notice down?"
        message={deleting ? `"${deleting.title}" comes off the notice board. It stays in this list, marked removed, and can be restored.` : ""}
        confirmLabel="Take down"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting._id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Taken off the notice board", "success");
            },
            onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
          })
        }
      />
    </>
  );
}
