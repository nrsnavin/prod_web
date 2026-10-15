import { ReactNode, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/components/ui/cn";
import { elasticService } from "./api";
import { Elastic, MaterialWeight } from "./types";
import { MAX_COMPARE, freeStock } from "./ElasticBulkActions";

// ══════════════════════════════════════════════════════════════════
//  2 TO 5 ELASTICS SIDE BY SIDE
//
//  Opened from the list's selection (/elastics/compare?ids=a,b,c). One
//  row per property; a row whose values are not all the same is marked,
//  and "Only differences" hides the rest — the question is usually
//  "what makes these two different?".
// ══════════════════════════════════════════════════════════════════

const num = (v: number | undefined | null, unit = "", dp = 2) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toLocaleString("en-IN", { maximumFractionDigits: dp })}${unit}`;
const money = (v: number | undefined | null) =>
  v == null || !Number.isFinite(v) ? "—" : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const material = (mw?: MaterialWeight) => {
  if (!mw?.id) return "—";
  const name = typeof mw.id === "object" ? mw.id.name : String(mw.id);
  return mw.weight != null ? `${name} · ${mw.weight} g/m` : name;
};

interface Row {
  section: string;
  label: string;
  value: (e: Elastic) => string;
}

export const COMPARE_ROWS: Row[] = [
  { section: "Construction", label: "Weave type", value: (e) => e.weaveType || "—" },
  { section: "Construction", label: "Width (mm)", value: (e) => num(e.testingParameters?.width) },
  { section: "Construction", label: "Weight (g/m)", value: (e) => num(e.weight, "", 3) },
  { section: "Construction", label: "Pick", value: (e) => num(e.pick) },
  { section: "Construction", label: "Hooks", value: (e) => num(e.noOfHook, "", 0) },
  { section: "Construction", label: "Spandex ends", value: (e) => num(e.spandexEnds, "", 0) },
  { section: "Construction", label: "Yarn ends", value: (e) => num(e.yarnEnds, "", 0) },
  { section: "Composition", label: "Warp spandex", value: (e) => material(e.warpSpandex) },
  { section: "Composition", label: "Spandex covering", value: (e) => material(e.spandexCovering) },
  { section: "Composition", label: "Weft yarn", value: (e) => material(e.weftYarn) },
  {
    section: "Composition",
    label: "Warp yarns",
    value: (e) => (e.warpYarn?.length ? e.warpYarn.map(material).join("\n") : "—"),
  },
  { section: "Cost a metre", label: "Material", value: (e) => money(e.costing?.materialCost) },
  { section: "Cost a metre", label: "Conversion", value: (e) => money(e.costing?.conversionCost ?? e.conversionCost) },
  { section: "Cost a metre", label: "Total", value: (e) => money(e.costing?.totalCost) },
  { section: "Testing", label: "Elongation (%)", value: (e) => num(e.testingParameters?.elongation) },
  { section: "Testing", label: "Recovery (%)", value: (e) => num(e.testingParameters?.recovery) },
  { section: "Testing", label: "Stretch", value: (e) => e.testingParameters?.strech || "—" },
  { section: "Stock (m)", label: "On the shelf", value: (e) => num(e.stock ?? 0, "", 0) },
  { section: "Stock (m)", label: "Free", value: (e) => num(freeStock(e), "", 0) },
  { section: "Stock (m)", label: "Min stock", value: (e) => num(e.minStock ?? 0, "", 0) },
];

/** The ids in the URL, de-duplicated and capped. */
export function compareIds(raw: string | null): string[] {
  return [...new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_COMPARE);
}

export function ElasticComparePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ids = compareIds(params.get("ids"));
  const [onlyDiff, setOnlyDiff] = useState(false);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["elastics", "detail", id],
      queryFn: () => elasticService.getById(id),
      enabled: ids.length >= 2,
    })),
  });
  const loading = queries.some((q) => q.isLoading);
  const failed = queries.find((q) => q.isError);
  const elastics = queries.map((q) => q.data).filter((e): e is Elastic => !!e);

  const back = (
    <Button variant="secondary" onClick={() => navigate("/elastics")}>
      <ArrowLeft className="h-4 w-4" /> Elastics
    </Button>
  );

  if (ids.length < 2) {
    return (
      <>
        <PageHeader title="Compare elastics" actions={back} />
        <Card className="p-6 text-sm text-ink-600">
          Tick 2 to {MAX_COMPARE} elastics on the list and choose Compare.
        </Card>
      </>
    );
  }

  const rows = COMPARE_ROWS.map((r) => {
    const values = elastics.map(r.value);
    return { ...r, values, differs: new Set(values).size > 1 };
  });
  const shown = onlyDiff ? rows.filter((r) => r.differs) : rows;
  const diffCount = rows.filter((r) => r.differs).length;

  let lastSection = "";
  const body: ReactNode[] = [];
  for (const r of shown) {
    if (r.section !== lastSection) {
      lastSection = r.section;
      body.push(
        <tr key={`s-${r.section}`} className="bg-ink-50">
          <th colSpan={elastics.length + 1} scope="colgroup"
            className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
            {r.section}
          </th>
        </tr>
      );
    }
    body.push(
      <tr key={`${r.section}-${r.label}`} data-differs={r.differs || undefined}
        className={cn("border-t border-ink-100", r.differs && "bg-status-warning/5")}>
        <th scope="row" className="whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-ink-600">
          {r.differs && <span aria-label="differs" className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-status-warning align-middle" />}
          {r.label}
        </th>
        {r.values.map((v, i) => (
          <td key={elastics[i]._id} className="whitespace-pre-line px-3 py-2 text-sm tabular-nums">{v}</td>
        ))}
      </tr>
    );
  }

  return (
    <>
      <PageHeader
        title="Compare elastics"
        subtitle={loading ? undefined : `${elastics.length} side by side · ${diffCount} ${diffCount === 1 ? "difference" : "differences"}`}
        actions={back}
      />
      {failed && <ErrorBanner message={(failed.error as Error).message} />}
      <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-600">
        <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)}
          className="h-4 w-4 rounded border-ink-300 accent-brand-500" />
        Only differences
      </label>
      <Card className="overflow-x-auto">
        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</div>
        ) : (
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                <th className="w-40 px-3 py-3" />
                {elastics.map((e) => (
                  <th key={e._id} scope="col" className="px-3 py-3 text-left align-bottom">
                    <Link to={`/elastics/${e._id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                      {e.name}
                    </Link>
                    {e.archived && <StatusChip tone="warning" className="ml-2">Inactive</StatusChip>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{body}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
