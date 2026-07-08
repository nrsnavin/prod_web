import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAuth } from "@/core/auth/useAuth";

// Stage 1 placeholder — real KPIs, charts and widgets land in Stage 2.
export function DashboardPage() {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.username ?? "there"}`}
        subtitle="Here's what's happening on the floor today."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open Orders", hint: "Stage 2" },
          { label: "Jobs In Production", hint: "Stage 2" },
          { label: "Machines Running", hint: "Stage 2" },
          { label: "Present Today", hint: "Stage 2" },
        ].map(({ label, hint }) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-ink-400">{label}</p>
            <p className="mt-1 text-3xl font-bold text-ink-200">—</p>
            <div className="mt-3">
              <StatusChip tone="info">{hint}</StatusChip>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-6">
        <h3 className="font-semibold">Stage 1 complete — shell &amp; foundation</h3>
        <p className="mt-1 text-sm text-ink-600 max-w-2xl">
          Login, session handling, the design system, navigation shell and
          global search (⌘K) are live. Dashboard KPIs, production analytics and
          the announcements widget arrive in Stage 2 after approval.
        </p>
      </Card>
    </>
  );
}
