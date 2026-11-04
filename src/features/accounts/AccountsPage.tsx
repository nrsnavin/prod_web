import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Inbox, ArrowDownLeft, ArrowUpRight, BookOpen, Settings2,
  FileText, Wallet, ArrowLeftRight, FileMinus, BarChart3, Landmark, BellRing, History, Send, LineChart, ListChecks, Repeat, LayoutDashboard, ShieldCheck, Scale,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/components/ui/cn";
import { InboxTab } from "./InboxTab";
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
import { ForecastTab } from "./ForecastTab";
import { CloseTab } from "./CloseTab";
import { RecurringTab } from "./RecurringTab";
import { ChecksTab } from "./ChecksTab";
import { StatutoryTab } from "./StatutoryTab";

export type AccountsTab =
  | "inbox" | "overview" | "collections" | "vouchers" | "notes" | "bills" | "expenses" | "recurring"
  | "bank" | "statements" | "reports" | "statutory" | "forecast" | "close" | "opening" | "tally" | "checks" | "settings";

type Door = "inbox" | "in" | "out" | "books" | "settings";
type Tab = { id: AccountsTab; label: string; icon: typeof FileText };

// Four doors and an inbox: money coming in, money going out, the books,
// and settings. The URL still names the tab, so old links keep working.
const DOORS: Array<{ id: Door; label: string; short?: string; icon: typeof FileText; tabs: Tab[] }> = [
  { id: "inbox", label: "Inbox", icon: Inbox, tabs: [{ id: "inbox", label: "Inbox", icon: Inbox }] },
  { id: "in", label: "Money in", short: "In", icon: ArrowDownLeft, tabs: [
    { id: "collections", label: "Collections", icon: BellRing },
    { id: "vouchers", label: "Receipts & payments", icon: ArrowLeftRight },
    { id: "notes", label: "Credit / debit notes", icon: FileMinus },
  ] },
  { id: "out", label: "Money out", short: "Out", icon: ArrowUpRight, tabs: [
    { id: "bills", label: "Supplier bills", icon: FileText },
    { id: "expenses", label: "Expenses", icon: Wallet },
    { id: "recurring", label: "Recurring", icon: Repeat },
  ] },
  { id: "books", label: "Books", icon: BookOpen, tabs: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "bank", label: "Bank", icon: Landmark },
    { id: "statements", label: "Statements", icon: BookOpen },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "statutory", label: "Statutory", icon: Scale },
    { id: "forecast", label: "Cash forecast", icon: LineChart },
    { id: "close", label: "Month end", icon: ListChecks },
    { id: "opening", label: "Opening balances", icon: History },
    { id: "tally", label: "To Tally", icon: Send },
    { id: "checks", label: "Checks", icon: ShieldCheck },
  ] },
  { id: "settings", label: "Settings", icon: Settings2, tabs: [{ id: "settings", label: "Settings", icon: Settings2 }] },
];

const ALL_TABS = DOORS.flatMap((d) => d.tabs.map((t) => t.id));
const doorOf = (tab: AccountsTab) => DOORS.find((d) => d.tabs.some((t) => t.id === tab))!;

/**
 * The money side of the paperwork: what suppliers billed, what was
 * spent, what came in and went out, and who owes what. Tally stays the
 * book of record; this is what the office keys and reads here.
 */
export function AccountsPage() {
  const { tab: raw } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const tab = (ALL_TABS.includes(raw as AccountsTab) ? raw : "inbox") as AccountsTab;
  const door = doorOf(tab);
  const go = (t: AccountsTab) => navigate(t === "inbox" ? "/accounts" : `/accounts/${t}`);
  // On a phone the sub-tabs scroll sideways: keep the open one in view.
  const activeTab = useRef<HTMLButtonElement>(null);
  useEffect(() => { activeTab.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }, [tab]);

  return (
    <>
      <PageHeader title="Accounts" subtitle="Bills, expenses, receipts and payments, ledgers — Tally stays the book of record." />
      {/* Five doors fit a phone's width: icon over label there, side by side above. */}
      <nav aria-label="Accounts" className="mb-2 grid grid-cols-5 gap-1 sm:flex">
        {DOORS.map((d) => (
          <button key={d.id} onClick={() => go(d.tabs[0].id)} aria-current={door.id === d.id ? "page" : undefined}
            className={cn("flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold transition-colors sm:shrink-0 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm",
              door.id === d.id ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800")}>
            <d.icon className="h-4 w-4 shrink-0" /> {d.short ? <><span className="max-w-full truncate sm:hidden">{d.short}</span><span className="hidden sm:inline">{d.label}</span></> : <span className="max-w-full truncate">{d.label}</span>}
          </button>
        ))}
      </nav>
      {door.tabs.length > 1 ? (
        <div className="mb-5 flex gap-1 overflow-x-auto no-scrollbar border-b border-ink-100">
          {door.tabs.map((t) => (
            <button key={t.id} ref={tab === t.id ? activeTab : undefined} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
              className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === t.id ? "border-brand-500 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-800")}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      ) : <div className="mb-5 border-b border-ink-100" />}
      {tab === "inbox" && <InboxTab />}
      {tab === "overview" && <OverviewTab />}
      {tab === "collections" && <CollectionsTab />}
      {tab === "vouchers" && <VouchersTab />}
      {tab === "notes" && <NotesTab />}
      {tab === "bills" && <BillsTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "recurring" && <RecurringTab />}
      {tab === "bank" && <BankStatementTab />}
      {tab === "statements" && <StatementsTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "statutory" && <StatutoryTab />}
      {tab === "forecast" && <ForecastTab />}
      {tab === "close" && <CloseTab />}
      {tab === "opening" && <OpeningTab />}
      {tab === "tally" && <TallyTab />}
      {tab === "checks" && <ChecksTab />}
      {tab === "settings" && <SettingsTab />}
    </>
  );
}
