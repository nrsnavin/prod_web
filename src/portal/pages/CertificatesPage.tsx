import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/core/format/date";
import { portal } from "../api";
import { BackLink, orderName, PageTitle } from "../ui";
import { NotFoundPage } from "./NotFoundPage";

// The test certificate for what an order (or one dispatch) carried: the
// latest passing test of each elastic. Printable: the page's own chrome
// is left off the paper.
export function CertificatesPage({ of }: { of: "order" | "dispatch" }) {
  const { id = "" } = useParams();
  const q = useQuery({
    queryKey: ["portal", "certificates", of, id],
    queryFn: () => (of === "order" ? portal.orderCertificates(id) : portal.dispatchCertificates(id)),
  });
  const summary = useQuery({ queryKey: ["portal", "summary"], queryFn: portal.summary });

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (q.isError) return <NotFoundPage what={of} />;
  const c = q.data!;
  const back = of === "order" ? `/orders/${id}` : `/dispatches/${id}`;
  const about = [c.dispatch ? `Dispatch ${c.dispatch.dcNumber}` : null, c.order ? orderName(c.order) : null, c.order?.po ? `PO ${c.order.po}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <BackLink to={back}>{of === "order" ? "The order" : "The dispatch"}</BackLink>
      <PageTitle
        title="Test certificates"
        sub={about}
        aside={c.certificates.length ? <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> Print</Button> : undefined}
      />
      {c.certificates.length === 0 ? (
        <EmptyState compact title="No test certificate yet" description="a certificate shows here once the goods have passed their tests" />
      ) : (
        <div className="space-y-4">
          {c.certificates.map((cert) => (
            <Card key={cert.elastic} className="p-5 print:break-inside-avoid print:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-ink-500">{summary.data?.company.name ?? ""} · Certificate of analysis</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-ink-900">{cert.name}</h2>
                  <p className="text-xs text-ink-500">
                    {summary.data?.customer.name ? `For ${summary.data.customer.name} · ` : ""}
                    {about}
                    {cert.job ? ` · run ${cert.job}` : ""}
                  </p>
                </div>
                <p className="text-right text-xs text-ink-500">
                  Tested {formatDate(cert.checkedAt)}
                  {cert.checkedBy && <span className="block">by {cert.checkedBy}</span>}
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="border-y border-ink-100 bg-surface-muted text-left text-xs font-medium text-ink-500">
                      <th className="px-3 py-2">Test</th>
                      <th className="px-3 py-2">Specified</th>
                      <th className="px-3 py-2">Measured</th>
                      <th className="px-3 py-2 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {cert.results.map((r) => (
                      <tr key={r.parameter}>
                        <td className="px-3 py-2.5 font-medium text-ink-900">{r.parameter}</td>
                        <td className="px-3 py-2.5 text-ink-600">{r.expected || "—"}</td>
                        <td className="px-3 py-2.5 tabular-nums">{r.measured}</td>
                        <td className="px-3 py-2.5 text-right">
                          {r.pass ? (
                            <span className="inline-flex items-center gap-1 font-medium text-status-success"><Check className="h-4 w-4" aria-hidden /> Pass</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-status-danger"><X className="h-4 w-4" aria-hidden /> Fail</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
