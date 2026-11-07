import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, Boxes, ClipboardList, Code2, Factory, Trash2, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { engineService } from "./engine/api";

// ══════════════════════════════════════════════════════════════════
//  Every report in one place: the ready-made ones by area, the queries
//  saved here, the chart dashboards, and "build your own". Each one
//  shows on screen and downloads as Excel or PDF.
// ══════════════════════════════════════════════════════════════════

const DASHBOARDS = [
  { title: "Production dashboard", description: "Metres by machine, shift, elastic or operator, with wastage and the period before.", icon: Factory, path: "/reports/production" },
  { title: "Dispatch dashboard", description: "Challans and value over time, by customer.", icon: Truck, path: "/reports/dispatch" },
  { title: "Order book dashboard", description: "Open and pending orders, and on-time delivery.", icon: ClipboardList, path: "/reports/order-book" },
  { title: "Stock and purchases dashboard", description: "Stock value and the PO register.", icon: Boxes, path: "/reports/stock-purchases" },
  { title: "Stock movement ledger", description: "Every receipt and issue, by material or day.", icon: ArrowLeftRight, path: "/reports/stock-movements" },
];
const ORDER = ["Sales", "Purchases", "Production", "Dispatch and orders", "Stock", "Money"];

export function ReportsLandingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["reports", "catalog"], queryFn: engineService.catalog, staleTime: 5 * 60_000 });
  const match = (t: string) => t.toLowerCase().includes(q.trim().toLowerCase());
  const groups = useMemo(() => {
    const by = new Map<string, NonNullable<typeof data>["reports"]>();
    for (const r of data?.reports ?? []) {
      if (q && !match(`${r.title} ${r.description} ${r.group}`)) continue;
      if (!by.has(r.group)) by.set(r.group, []);
      by.get(r.group)!.push(r);
    }
    return [...by.entries()].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q]);
  const saved = (data?.saved ?? []).filter((s) => !q || match(s.name));
  const dashboards = DASHBOARDS.filter((d) => !q || match(`${d.title} ${d.description}`));

  const remove = async (id: string, name: string) => {
    try { await engineService.remove(id); qc.invalidateQueries({ queryKey: ["reports", "catalog"] }); toast(`Removed “${name}”`, "success"); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not remove it", "error"); }
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Every report on screen, as Excel or as PDF — or build your own"
        actions={<Link to="/reports/query"><Button><Code2 className="h-4 w-4" /> Build a report</Button></Link>} />
      <div className="mb-5 max-w-md">
        <Input aria-label="Find a report" placeholder="Find a report — sales by customer, wastage, aging…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? <p role="alert" className="text-sm text-status-danger">{error instanceof Error ? error.message : "Could not load the reports"}</p> : null}
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-6">
          {saved.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">Saved</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {saved.map((s) => (
                  <li key={s._id}>
                    <Card className="flex items-center justify-between gap-2 p-3">
                      <Link to={`/reports/query?saved=${s._id}`} className="min-w-0 flex-1 hover:text-brand-600">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="truncate text-xs text-ink-500">{s.shared ? "Shared" : "Only you"}{s.createdByName ? ` · ${s.createdByName}` : ""}</p>
                      </Link>
                      <Button size="sm" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => remove(s._id, s.name)}><Trash2 className="h-4 w-4" /></Button>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {groups.map(([group, reports]) => (
            <section key={group}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">{group}</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link to={`/reports/r/${r.id}`} className="block h-full">
                      <Card className="flex h-full items-start justify-between gap-2 p-3 transition hover:shadow-card-hover">
                        <div className="min-w-0"><p className="font-medium">{r.title}</p><p className="text-sm text-ink-500">{r.description}</p></div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {dashboards.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-400">Dashboards with charts</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {dashboards.map((d) => (
                  <li key={d.path}>
                    <Link to={d.path} className="block h-full">
                      <Card className="flex h-full items-start gap-3 p-3 transition hover:shadow-card-hover">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><d.icon className="h-4 w-4" /></span>
                        <div className="min-w-0"><p className="font-medium">{d.title}</p><p className="text-sm text-ink-500">{d.description}</p></div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!groups.length && !saved.length && !dashboards.length && <p className="text-sm text-ink-500">No report matches “{q}”. <Link to="/reports/query" className="text-brand-600 underline">Build it yourself</Link>.</p>}
        </div>
      )}
    </>
  );
}
