import { useQuery } from "@tanstack/react-query";
import { ProgressRail, settle, type RailStep } from "@/components/ui/ProgressRail";
import { accountsService } from "@/features/accounts/api";
import { ACCOUNTS_KEY } from "@/features/accounts/hooks";
import type { PayrollBooks } from "@/features/accounts/types";
import type { PayrollDashboard } from "./api";
import type { PayrollCheckData } from "./PayrollCheck";

// ══════════════════════════════════════════════════════════════════
//  A MONTH'S PAYROLL
//
//  Month ended → generated → checked → finalised → paid → in the books.
//  Pay is worked out from the month's attendance, so it waits for the
//  month to end; the payroll check's flags are what "checked" clears;
//  paying a slip finalises it; the books take the salary journal and
//  the payments from Accounts → Statutory → Payroll.
//
//  The books step is only shown to someone who may open Accounts.
// ══════════════════════════════════════════════════════════════════

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function payrollSteps({
  year,
  month,
  summary,
  check,
  books,
  today = new Date(),
}: {
  year: number;
  month: number;
  summary?: PayrollDashboard["summary"];
  check?: PayrollCheckData;
  books?: PayrollBooks | null;
  today?: Date;
}): RailStep[] {
  const lastDay = new Date(year, month, 0).getDate();
  const ended = today > new Date(year, month - 1, lastDay, 23, 59, 59, 999);
  const drafts = summary?.draftCount ?? 0;
  const paid = summary?.paidCount ?? 0;
  const slips = drafts + (summary?.finalizedCount ?? 0) + paid + (summary?.partiallyPaidCount ?? 0);
  const generated = slips > 0;
  // Only a draft can still change, so only a draft's flags hold the month up.
  const toReview = (check?.rows ?? []).filter((r) => r.status === "draft" && r.flags.some((f) => f.severity !== "info")).length;
  const steps: Parameters<typeof settle>[0] = [
    { key: "ended", label: "Month ended", done: ended, detail: `1–${lastDay} ${MONTH[month - 1]}` },
    { key: "generated", label: "Generated", done: generated, detail: generated ? `${slips} slip${slips === 1 ? "" : "s"}` : undefined },
    {
      key: "checked",
      label: "Checked",
      done: generated && toReview === 0,
      detail: !generated ? undefined : toReview > 0 ? `${toReview} slip${toReview === 1 ? "" : "s"} to review` : "Nothing to review",
    },
    { key: "finalised", label: "Finalised", done: generated && drafts === 0, detail: generated ? `${slips - drafts} of ${slips}` : undefined },
    { key: "paid", label: "Paid", done: generated && paid === slips, detail: generated ? `${paid} of ${slips}` : undefined },
  ];
  if (books !== undefined) {
    const j = books?.journals;
    const salaryIn = !!j?.salary && !j.salaryStale;
    const paymentsIn = paid === 0 || (!!j?.paid && !j.paidStale);
    steps.push({
      key: "books",
      label: "In the books",
      done: generated && salaryIn && paymentsIn,
      detail: !generated
        ? undefined
        : !j?.salary
          ? "Salary journal to post"
          : j.salaryStale
            ? "Salary journal out of date"
            : !paymentsIn
              ? "Payments to post"
              : `Journal ${j.salary.journalNo}`,
    });
  }
  return settle(steps);
}

export function PayrollRail({
  year,
  month,
  summary,
  check,
  showBooks,
}: {
  year: number;
  month: number;
  summary?: PayrollDashboard["summary"];
  check?: PayrollCheckData;
  /** Whether this person may open Accounts, where the books step lives. */
  showBooks: boolean;
}) {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  // The same query, and cache entry, as Accounts → Statutory → Payroll.
  const books = useQuery({
    queryKey: [ACCOUNTS_KEY, "payroll-books", key],
    queryFn: () => accountsService.payrollBooks(key),
    enabled: showBooks,
  });
  const steps = payrollSteps({ year, month, summary, check, books: showBooks ? (books.data ?? null) : undefined });
  return <ProgressRail label={`Payroll · ${MONTH[month - 1]} ${year}`} steps={steps} className="mb-4" />;
}
