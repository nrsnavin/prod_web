import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileDown } from "lucide-react";
import { StatusChip, type ChipTone } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { quantity } from "@/core/format/money";
import type { InvoiceRow, Stage } from "./api";

// ── Words for the customer ─────────────────────────────────────────
export const STAGE: Record<Stage, { label: string; tone: ChipTone }> = {
  received: { label: "Received", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info" },
  in_production: { label: "In production", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function StageChip({ stage }: { stage: Stage }) {
  return <StatusChip tone={STAGE[stage].tone}>{STAGE[stage].label}</StatusChip>;
}

export function InvoiceStateChip({ inv }: { inv: Pick<InvoiceRow, "state" | "overdueDays"> }) {
  if (inv.state === "paid") return <StatusChip tone="success">Paid</StatusChip>;
  if (inv.state === "overdue")
    return <StatusChip tone="danger">{`Overdue ${inv.overdueDays} day${inv.overdueDays === 1 ? "" : "s"}`}</StatusChip>;
  if (inv.state === "part_paid") return <StatusChip tone="warning">Part paid</StatusChip>;
  return <StatusChip tone="neutral">Due</StatusChip>;
}

/** "1,500 m". */
export const m = (n: number) => quantity(n, "m");

/** "Order #118", or the customer's PO when there is no number yet. */
export const orderName = (o: { orderNo: number | null; po?: string }) =>
  o.orderNo != null ? `Order #${o.orderNo}` : o.po ? `PO ${o.po}` : "Order";

// ── Layout pieces ──────────────────────────────────────────────────
export function PageTitle({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl [text-wrap:balance]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
      </div>
      {aside && <div className="flex flex-wrap gap-2 print:hidden">{aside}</div>}
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 print:hidden">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {children}
    </Link>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-ink-700">{children}</h2>
      {aside}
    </div>
  );
}

/** A PDF the office prints, opened in a new tab. */
export function PdfLink({ href, children, variant = "button" }: { href: string; children: ReactNode; variant?: "button" | "inline" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        variant === "button"
          ? "rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-700 hover:bg-ink-100"
          : "text-sm text-brand-600 underline-offset-2 hover:underline",
      )}
    >
      <FileDown className="h-4 w-4" aria-hidden /> {children}
    </a>
  );
}

/** How much of `of` is `done`, as a bar with words for a screen reader. */
export function Progress({ done, of, label }: { done: number; of: number; label: string }) {
  const pct = of > 0 ? Math.min(100, Math.round((done / of) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
    >
      <div className={cn("h-full rounded-full", pct >= 100 ? "bg-status-success" : "bg-brand-500")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A table that may scroll sideways on a narrow screen. While it does, the
 * box takes keyboard focus and carries a name, so it can be scrolled
 * without a mouse; while the table fits, it is a plain box and adds no tab
 * stop.
 */
export function ScrollRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const check = () => setScrolls(box.scrollWidth > box.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(box);
    if (box.firstElementChild) ro.observe(box.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={cn(
        "overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500",
        className,
      )}
      {...(scrolls ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}
    >
      {children}
    </div>
  );
}

/** A label above its value, for the facts at the top of a page. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink-900">{children || "—"}</dd>
    </div>
  );
}
