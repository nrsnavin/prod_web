import { useState } from "react";
import { FileText, PanelLeft, LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/core/auth/useAuth";
import { DocumentSettingsForm } from "./DocumentSettingsForm";
import { SidebarLayoutEditor } from "./SidebarLayoutEditor";
import { PdfDesignerPage } from "@/features/pdfTemplates/PdfDesignerPage";

type Tab = "sidebar" | "documents" | "designer";

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("sidebar");

  const TABS: { id: Tab; label: string; icon: typeof FileText; adminOnly?: boolean }[] = [
    { id: "sidebar", label: "Sidebar layout", icon: PanelLeft },
    { id: "documents", label: "Documents & Branding", icon: FileText },
    { id: "designer", label: "PDF Designer", icon: LayoutTemplate, adminOnly: true },
  ];
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <>
      <PageHeader title="Settings" subtitle="Personalize your sidebar and configure document branding" />

      <div className="mb-6 flex gap-1 border-b border-ink-100">
        {tabs.map((t) => (
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

      {tab === "sidebar" && <SidebarLayoutEditor />}
      {tab === "documents" && <DocumentSettingsForm />}
      {tab === "designer" && isAdmin && <PdfDesignerPage />}
    </>
  );
}
