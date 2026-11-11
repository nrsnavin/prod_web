import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressRail, settle } from "@/components/ui/ProgressRail";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/core/format/date";
import { portal, pdfUrl, type OrderDetail, type Stage } from "../api";
import { BackLink, Fact, m, orderName, PageTitle, PdfLink, Progress, ScrollRegion, SectionTitle, StageChip } from "../ui";
import { NotFoundPage } from "./NotFoundPage";

const ORDER = ["received", "confirmed", "in_production", "completed"] as const;

/**
 * Where the order stands. A step is done once the order is past it, so
 * an order being woven shows "In production" as the step it is on, not
 * as finished; it is finished when everything ordered has left.
 */
function railOf(o: OrderDetail) {
  const at = ORDER.indexOf(o.stage as (typeof ORDER)[number]);
  const reached = (s: Stage) => at >= ORDER.indexOf(s as (typeof ORDER)[number]);
  const allOut = o.stage === "completed" || (o.totals.ordered > 0 && o.totals.dispatched >= o.totals.ordered);
  return settle([
    { key: "received", label: "Received", detail: formatDate(o.date), done: true },
    { key: "confirmed", label: "Confirmed", done: reached("confirmed") },
    {
      key: "in_production",
      label: "In production",
      detail: o.totals.produced > 0 ? `${m(o.totals.produced)} woven` : undefined,
      done: allOut,
    },
    { key: "dispatched", label: "Dispatched", detail: `${m(o.totals.dispatched)} of ${m(o.totals.ordered)}`, done: allOut },
  ]);
}

function LineFigure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className={strong ? "font-semibold tabular-nums text-ink-900" : "tabular-nums text-ink-700"}>{value}</dd>
    </div>
  );
}

export function OrderPage() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["portal", "order", id], queryFn: () => portal.order(id) });

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (q.isError) return <NotFoundPage what="order" />;
  const o = q.data!;

  return (
    <>
      <BackLink to="/orders">Orders</BackLink>
      <PageTitle
        title={orderName(o)}
        sub={o.po ? `Your PO ${o.po}` : undefined}
        aside={
          o.hasCertificates ? (
            <Link
              to={`/orders/${o.id}/certificates`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"
            >
              <BadgeCheck className="h-4 w-4" aria-hidden /> Test certificates
            </Link>
          ) : undefined
        }
      />

      <Card className="p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fact label="Status"><StageChip stage={o.stage} /></Fact>
          <Fact label="Ordered on">{formatDate(o.date)}</Fact>
          <Fact label="Due">{formatDate(o.supplyDate)}</Fact>
          <Fact label="Still to come">{m(o.totals.toCome)}</Fact>
        </dl>
      </Card>

      {o.stage === "cancelled" ? (
        <p className="mt-4 rounded-lg bg-status-dangerBg px-4 py-3 text-sm text-status-danger">This order was cancelled.</p>
      ) : (
        <ProgressRail label="Where the order stands" steps={railOf(o)} className="mt-4" />
      )}

      <Card className="mt-4 overflow-hidden">
        <div className="px-5 pt-5"><SectionTitle>What you ordered</SectionTitle></div>
        {/* On a phone, each elastic as a card: the table's five columns do not fit. */}
        <ul className="divide-y divide-ink-100 border-t border-ink-100 sm:hidden">
          {o.lines.map((l) => (
            <li key={l.elastic} className="px-5 py-4">
              <p className="font-medium text-ink-900">{l.name}</p>
              <div className="mt-2"><Progress done={l.dispatched} of={l.ordered} label={`${l.name} dispatched`} /></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <LineFigure label="Ordered" value={m(l.ordered)} />
                <LineFigure label="Woven" value={m(l.produced)} />
                <LineFigure label="Dispatched" value={m(l.dispatched)} />
                <LineFigure label="To come" value={m(l.toCome)} strong />
              </dl>
            </li>
          ))}
          <li className="flex justify-between px-5 py-3 text-sm font-semibold">
            <span>Total to come</span>
            <span className="tabular-nums">{m(o.totals.toCome)} of {m(o.totals.ordered)}</span>
          </li>
        </ul>
        <ScrollRegion label="What you ordered" className="hidden sm:block">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-y border-ink-100 bg-surface-muted text-left text-xs font-medium text-ink-500">
                <th className="px-5 py-2.5">Elastic</th>
                <th className="px-3 py-2.5 text-right">Ordered</th>
                <th className="px-3 py-2.5 text-right">Woven</th>
                <th className="px-3 py-2.5 text-right">Dispatched</th>
                <th className="px-5 py-2.5 text-right">To come</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {o.lines.map((l) => (
                <tr key={l.elastic}>
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink-900">{l.name}</span>
                    <span className="mt-1.5 block max-w-[12rem]"><Progress done={l.dispatched} of={l.ordered} label={`${l.name} dispatched`} /></span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{m(l.ordered)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink-600">{m(l.produced)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{m(l.dispatched)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">{m(l.toCome)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-200 font-semibold">
                <td className="px-5 py-3">Total</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{m(o.totals.ordered)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{m(o.totals.produced)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{m(o.totals.dispatched)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{m(o.totals.toCome)}</td>
              </tr>
            </tfoot>
          </table>
        </ScrollRegion>
      </Card>

      <Card className="mt-4 p-5">
        <SectionTitle>Dispatches against this order</SectionTitle>
        {o.dispatches.length === 0 ? (
          <EmptyState compact title="Nothing dispatched yet" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {o.dispatches.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link to={`/dispatches/${d.id}`} className="group min-w-0">
                  <span className="flex items-center gap-1 text-sm font-medium text-ink-900 group-hover:text-brand-600">
                    {d.dcNumber} <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden />
                  </span>
                  <span className="block text-xs text-ink-500">{formatDate(d.date)} · {m(d.quantity)}</span>
                </Link>
                <PdfLink href={pdfUrl(`/dispatches/${d.id}/pdf`)} variant="inline">Challan</PdfLink>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
