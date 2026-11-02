import { useNavigate, useParams } from "react-router-dom";
import { LayoutDashboard, FileText, Wallet, ArrowLeftRight, FileMinus, BookOpen, BarChart3, Settings2, Landmark, BellRing, History, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/components/ui/cn";
import { OverviewTab } from "./OverviewTab";
import { BillsTab } from "./BillsTab";
import { ExpensesTab } from "./ExpensesTab";
import { VouchersTab } from "./VouchersTab";
import { NotesTab } from "./NotesTab";
import { StatementsTab } from "./StatementsTab";
import { ReportsTab } from "./ReportsTab";
import { SettingsTab } from "./SettingsTab";
import { BankStatementTab } from "./BankStatementTab";
import { CollectionsTab } from "./CollectionsTab";
import { OpeningTab } from "./OpeningTab";
import { TallyTab } from "./TallyTab";

export type AccountsTab = "overview" | "bills" | "expenses" | "vouchers" | "notes" | "bank" | "collections" | "statements" | "reports" | "opening" | "tally" | "settings";

const TABS: { id: AccountsTab; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "bills", label: "Supplier bills", icon: FileText },
  { id: "expenses", label: "Expenses", icon: Wallet },
  { id: "vouchers", label: "Receipts & payments", icon: ArrowLeftRight },
  { id: "notes", label: "Credit / debit notes", icon: FileMinus },
  { id: "bank", label: "Bank statement", icon: Landmark },
  { id: "collections", label: "Collections", icon: BellRing },
  { id: "statements", label: "Statements", icon: BookOpen },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "opening", label: "Opening balances", icon: History },
  { id: "tally", label: "To Tally", icon: Send },
  { id: "settings", label: "Settings", icon: Settings2 },
];

/**
 * The money side of the paperwork: what suppliers billed, what was
 * spent, what came in and went out, and who owes what. Tally stays the
 * book of record; this is what the office keys and reads here.
 */
export function AccountsPage() {
  const { tab: raw } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const tab = (TABS.some((t) => t.id === raw) ? raw : "overview") as AccountsTab;

  return (
    <>
      <PageHeader title="Accounts" subtitle="Bills, expenses, receipts and payments, ledgers — Tally stays the book of record." />
      <div className="mb-5 flex gap-1 overflow-x-auto no-scrollbar border-b border-ink-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(t.id === "overview" ? "/accounts" : `/accounts/${t.id}`)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-800"
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "bills" && <BillsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "vouchers" && <VouchersTab />}
      {tab === "notes" && <NotesTab />}
      {tab === "bank" && <BankStatementTab />}
      {tab === "collections" && <CollectionsTab />}
      {tab === "statements" && <StatementsTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "opening" && <OpeningTab />}
      {tab === "tally" && <TallyTab />}
      {tab === "settings" && <SettingsTab />}
    </>
  );
}
