import { useLocation } from "react-router-dom";
import { Hammer } from "lucide-react";
import { allNavItems } from "@/app/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// Placeholder rendered for every feature that has a nav entry but whose
// build stage hasn't landed yet. Replaced feature-by-feature in Stages 2–7.
export function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = allNavItems.find((i) => i.path === pathname);
  const title = item?.label ?? "Coming soon";

  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={<Hammer className="h-12 w-12" />}
          title={`${title} is on the way`}
          description="This module is planned in an upcoming build stage of the web app. The navigation is already wired — the screens land here next."
        />
      </Card>
    </>
  );
}
