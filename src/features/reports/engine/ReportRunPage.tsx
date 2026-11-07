import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Code2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { engineService, type Condition, type Period } from "./api";
import { Downloads, FilterRows, PeriodPicker, ResultView, usable } from "./parts";

/** One ready-made report: its period, any filters, the table, and the downloads. */
export function ReportRunPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const catalog = useQuery({ queryKey: ["reports", "catalog"], queryFn: engineService.catalog, staleTime: 5 * 60_000 });
  const def = catalog.data?.reports.find((r) => r.id === id);
  const dataset = catalog.data?.datasets.find((d) => d.id === def?.query.dataset);
  const [period, setPeriod] = useState<Period>({ preset: "month" });
  const [filters, setFilters] = useState<Condition[]>([]);
  const payload = { report: id, filters: usable(filters), ...period };
  const run = useQuery({
    queryKey: ["reports", "run", payload],
    queryFn: () => engineService.run(payload),
    enabled: !!def && (period.preset !== "custom" || (!!period.from && !!period.to)),
    retry: false,
  });

  if (catalog.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!def || !dataset) return <Card className="p-6"><p className="text-sm text-ink-600">This report is not there, or is not one you can see.</p><Link to="/reports" className="text-sm text-brand-600 underline">All reports</Link></Card>;

  return (
    <>
      <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Reports</Link>
      <PageHeader title={def.title} subtitle={def.description}
        actions={<>
          <Downloads disabled={!run.data} onDownload={(f) => engineService.download(payload, f, `${def.title} ${run.data?.rangeLabel ?? ""}`)} />
          <Button size="sm" variant="ghost" onClick={() => navigate("/reports/query", { state: { query: { ...def.query, where: [...(def.query.where ?? []), ...usable(filters)] }, title: def.title, period } })}><Code2 className="h-4 w-4" /> Edit as a query</Button>
        </>} />
      <Card className="mb-4 space-y-3 p-4">
        <PeriodPicker value={period} onChange={setPeriod} disabled={!def.dated} />
        <FilterRows dataset={dataset} value={filters} onChange={setFilters} />
      </Card>
      <ResultView data={run.data} loading={run.isFetching} error={run.error instanceof Error ? run.error.message : null} />
    </>
  );
}
