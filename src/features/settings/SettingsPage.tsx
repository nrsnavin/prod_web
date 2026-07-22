import { useState } from "react";
import { FileText, PanelLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/components/ui/cn";
import { DocumentSettingsForm } from "./DocumentSettingsForm";
import { SidebarLayoutEditor } from "./SidebarLayoutEditor";

type Tab = "sidebar" | "documents";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "sidebar", label: "Sidebar layout", icon: PanelLeft },
  { id: "documents", label: "Documents & Branding", icon: FileText },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("sidebar");

  return (
    <>
      <PageHeader title="Settings" subtitle="Personalize your sidebar and configure document branding" />

      <div className="mb-6 flex gap-1 border-b border-ink-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-ink-500 hover:text-ink-800"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "sidebar" ? <SidebarLayoutEditor /> : <DocumentSettingsForm />}
    </>
  );
}
