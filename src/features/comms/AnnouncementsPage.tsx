import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pin, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
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
    resolver: zodResolver(schema),
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
      <div className="grid grid-cols-3 gap-3">
        <Select
          label="Type"
          options={["info", "warning", "urgent", "celebration"].map((t) => ({ value: t, label: t }))}
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
        {audience === "department" ? (
          <Input label="Department" placeholder="e.g. weaving" {...register("department")} />
        ) : (
          <Input label="Valid until" type="date" {...register("validUntil")} />
        )}
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
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Broadcast to the employee app's notice board."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        }
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
          <EmptyState title="No announcements" description="Post one to reach the floor." />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.map((a) => (
            <Card key={a._id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold flex items-center gap-2">
                    {a.isPinned && <Pin className="h-3.5 w-3.5 text-brand-500" />}
                    {a.title}
                    {a.audience === "department" && (
                      <StatusChip tone="info">{a.department}</StatusChip>
                    )}
                  </p>
                  {a.body && <p className="mt-1 text-sm text-ink-600">{a.body}</p>}
                  <p className="mt-1 text-xs text-ink-400">
                    {a.createdAt && new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
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
              </div>
            </Card>
          ))}
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
        title="Delete announcement?"
        message={deleting?.title ?? ""}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting._id, {
            onSuccess: () => {
              setDeleting(null);
              toast("Announcement deleted", "success");
            },
            onError: (e) => toast(e instanceof ApiError ? e.message : "Failed", "error"),
          })
        }
      />
    </>
  );
}
