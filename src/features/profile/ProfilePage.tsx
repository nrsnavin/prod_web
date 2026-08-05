import { useQuery } from "@tanstack/react-query";
import { Mail, Calendar, Building2, ShieldCheck, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { DEPARTMENT_LABELS, FEATURE_GROUPS } from "@/app/navigation";
import { profileService } from "./api";

// Read fresh from the server rather than the auth store: the session
// persisted at login never carried email or the linked Employee record
// (login-user/verify-otp don't return them), so this is the one place
// that shows the complete picture.
function useMe() {
  return useQuery({ queryKey: ["me", "profile"], queryFn: profileService.getMe });
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?";

export function ProfilePage() {
  const { data: me, isLoading, isError, error } = useMe();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !me) {
    return <ErrorBanner message={(error as Error | null)?.message ?? "Could not load your profile"} />;
  }

  const featureSet = new Set(me.features);
  const memberSince = me.createdAt
    ? new Date(me.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : undefined;

  return (
    <>
      <PageHeader title="Your profile" subtitle="Your account details and what you can access." />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-100 text-xl font-bold uppercase text-brand-600">
            {initials(me.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{me.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusChip tone={me.role === "admin" ? "info" : "neutral"}>{me.role}</StatusChip>
              {me.department && (
                <StatusChip tone="neutral">
                  {DEPARTMENT_LABELS[me.department] ?? me.department}
                </StatusChip>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-ink-100 pt-5">
          <DescriptionList
            items={[
              {
                label: "Email",
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-ink-400" /> {me.email}
                  </span>
                ),
              },
              {
                label: "Role",
                value: (
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    <ShieldCheck className="h-3.5 w-3.5 text-ink-400" /> {me.role}
                  </span>
                ),
              },
              {
                label: "Department",
                value: me.department ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-ink-400" />
                    {DEPARTMENT_LABELS[me.department] ?? me.department}
                  </span>
                ) : undefined,
              },
              {
                label: "Member since",
                value: memberSince ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-ink-400" /> {memberSince}
                  </span>
                ) : undefined,
              },
            ]}
          />
        </div>
      </Card>

      {me.employee && (
        <Card className="mt-4 p-5">
          <h3 className="font-semibold">Work details</h3>
          <p className="text-xs text-ink-400">From your linked employee record.</p>
          <div className="mt-4">
            <DescriptionList
              items={[
                { label: "Employee name", value: me.employee.name },
                {
                  label: "Employee department",
                  value: me.employee.department
                    ? DEPARTMENT_LABELS[me.employee.department] ?? me.employee.department
                    : undefined,
                },
                { label: "Phone", value: me.employee.phoneNumber },
                {
                  label: "Hourly rate",
                  value:
                    me.employee.hourlyRate != null
                      ? `₹${me.employee.hourlyRate.toLocaleString("en-IN")} / hr`
                      : undefined,
                },
              ]}
            />
          </div>
        </Card>
      )}

      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Feature access</h3>
        <p className="text-xs text-ink-400">
          What your login can open. Ask an admin on the Users page if something you need is missing.
        </p>
        <div className="mt-4 space-y-4">
          {FEATURE_GROUPS.map((group) => {
            const visible = group.features.filter((f) => f.always || featureSet.has(f.key));
            if (visible.length === 0) return null;
            return (
              <div key={group.section}>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {group.section}
                </p>
                <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((f) => (
                    <span key={f.key} className="inline-flex items-center gap-1.5 text-sm text-ink-700">
                      <Check className="h-3.5 w-3.5 shrink-0 text-status-success" />
                      {f.label}
                      {f.always && (
                        <span className="text-[10px] uppercase text-ink-400">always</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
