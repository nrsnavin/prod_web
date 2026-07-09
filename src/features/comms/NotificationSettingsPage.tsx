import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ApiError } from "@/core/http/httpClient";
import { notifyService } from "./api";

function recipientLabel(r: unknown): string {
  if (typeof r === "string") return r;
  const o = r as { phone?: string; number?: string; name?: string };
  return o.name ? `${o.name} (${o.phone ?? o.number ?? ""})` : (o.phone ?? o.number ?? "");
}

export function NotificationSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newNumber, setNewNumber] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["notify-settings"],
    queryFn: notifyService.settings,
  });
  const update = useMutation({
    mutationFn: notifyService.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notify-settings"] }),
  });

  const s = data?.settings;
  const onError = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : "Update failed", "error");

  return (
    <>
      <PageHeader
        title="Notification settings"
        subtitle="WhatsApp/SMS alerts for critical floor events."
      />

      {isError && <ErrorBanner message={(error as Error).message} />}

      {isLoading || !s ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-lg bg-ink-100 grid place-items-center text-ink-600">
                <BellRing className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold">Notifications</h3>
                <p className="text-xs text-ink-400">
                  Provider: {data!.provider.name}{" "}
                  {data!.provider.configured ? (
                    <StatusChip tone="success">configured</StatusChip>
                  ) : (
                    <StatusChip tone="warning">dry-run</StatusChip>
                  )}
                </p>
              </div>
              <Button
                variant={s.enabled ? "secondary" : "primary"}
                size="sm"
                loading={update.isPending}
                onClick={() =>
                  update.mutate(
                    { enabled: !s.enabled },
                    {
                      onSuccess: () =>
                        toast(s.enabled ? "Notifications disabled" : "Notifications enabled", "success"),
                      onError,
                    }
                  )
                }
              >
                {s.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
            {s.timezone && (
              <p className="mt-3 text-sm text-ink-600">
                Timezone: <span className="font-medium">{s.timezone}</span>
                {s.quietHours?.start && (
                  <> · Quiet hours {s.quietHours.start}–{s.quietHours.end}</>
                )}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold">Recipients</h3>
            <ul className="mt-2 divide-y divide-ink-100">
              {s.recipients.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span>{recipientLabel(r)}</span>
                  <button
                    onClick={() =>
                      update.mutate(
                        { recipients: s.recipients.filter((_, x) => x !== i) as never },
                        { onSuccess: () => toast("Recipient removed", "success"), onError }
                      )
                    }
                    className="p-1 rounded text-ink-400 hover:text-status-danger"
                    aria-label="Remove recipient"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {s.recipients.length === 0 && (
                <li className="py-2 text-sm text-ink-400">No recipients yet.</li>
              )}
            </ul>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="+91XXXXXXXXXX"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
              />
              <Button
                disabled={!newNumber.trim()}
                loading={update.isPending}
                onClick={() =>
                  update.mutate(
                    { recipients: [...s.recipients, newNumber.trim()] as never },
                    {
                      onSuccess: () => {
                        setNewNumber("");
                        toast("Recipient added", "success");
                      },
                      onError,
                    }
                  )
                }
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
