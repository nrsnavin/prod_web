import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { accountsService } from "./api";
import { ACCOUNTS_KEY } from "./hooks";
import { money } from "./shared";
import { MonthReview } from "./MonthReview";
import { MonthEndRail } from "./MonthEndRail";

const lastMonth = () => { const d = new Date(); const p = new Date(d.getFullYear(), d.getMonth() - 1, 1); return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`; };

const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : ym;
};

/** What is left before a month's books can be closed and sent to Tally. */
export function CloseTab() {
  const [month, setMonth] = useState(lastMonth);
  const { data, isLoading } = useQuery({ queryKey: [ACCOUNTS_KEY, "close", month], queryFn: () => accountsService.closeChecklist(month) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {data && <p className="pb-2 text-sm text-ink-500"><span className="font-semibold text-ink-900">{data.done} of {data.total}</span> done</p>}
      </div>
      {data && <MonthEndRail items={data.items} monthLabel={monthName(month)} />}
      <MonthReview month={month} />
      {isLoading || !data ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <ul className="divide-y divide-ink-100" aria-label="Month-end checklist">
            {data.items.map((i) => (
              <li key={i.key} className="flex items-start gap-3 px-4 py-3">
                {i.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-success" aria-label="done" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-300" aria-label="to do" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.label}</p>
                  <p className="text-sm text-ink-500">{i.detail}</p>
                </div>
                {!i.ok && i.amount ? <span className="tabular-nums text-sm font-semibold">₹{money(i.amount)}</span> : null}
                {!i.ok && <Link to={i.link} className="shrink-0 text-sm text-brand-600 hover:underline">Open</Link>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-ink-400">Ask Jarvis "what is left to close last month" for the same list. With the month-end reminder set up on the server, the owner gets it on WhatsApp on the 1st.</p>
    </div>
  );
}
