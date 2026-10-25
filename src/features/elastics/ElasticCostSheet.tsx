import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Calculator, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormScreen } from "@/components/ui/FormScreen";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { formatDate } from "@/core/format/date";
import { useCostSheet, useElasticMutations } from "./hooks";
import { CostSheet, CostSheetLine, recostMessage } from "./api";

// ══════════════════════════════════════════════════════════════════
//  THE COST SHEET, ON THE ELASTIC PAGE
//
//  Every material in the recipe: grams a metre, its price today, what
//  it costs in a metre — and the price the last costing used, so a
//  price that has moved shows, and the total this elastic carries can
//  be seen to be out of date before anyone quotes from it.
//
//  "Edit prices" changes the material's price in the raw-material
//  master (with a history entry, as a price revision anywhere does) and
//  the conversion cost, then recalculates. A material's price is the
//  same for every elastic that uses it, so the dialog says how many
//  others share each one and offers to recalculate those too.
// ══════════════════════════════════════════════════════════════════

/** ₹ a metre: small figures, so up to four places. */
export const perMetre = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
/** ₹ a kg. */
export const perKg = (n: number | null | undefined) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ElasticCostSheet({ elasticId }: { elasticId: string }) {
  const { data: sheet, isLoading, isError, error } = useCostSheet(elasticId);
  const { recalculate } = useElasticMutations();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  if (isLoading) return <Skeleton className="mt-4 h-56 w-full" />;
  if (isError || !sheet) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="font-semibold">Cost sheet</h3>
        <p className="mt-2 text-sm text-status-danger">{error instanceof ApiError ? error.message : "The cost sheet could not be loaded."}</p>
      </Card>
    );
  }

  const recalc = () =>
    recalculate.mutate(elasticId, {
      onSuccess: (r) => toast(recostMessage(r), "success"),
      onError: (e) => toast(e instanceof ApiError ? e.message : "Recalculation failed", "error"),
    });

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h3 className="font-semibold">Cost sheet</h3>
          <p className="text-sm text-ink-400">A metre, at today&apos;s material prices</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={!sheet.lines.length}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit prices
        </Button>
      </div>

      {sheet.stale && sheet.costed && (
        <div className="mx-5 mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            This elastic carries {perMetre(sheet.costed.totalCost)} a metre
            {sheet.costed.at ? `, worked out on ${formatDate(sheet.costed.at)}` : ""}. Today&apos;s prices make it{" "}
            <span className="font-semibold">{perMetre(sheet.now.totalCost)}</span>.
          </p>
          <Button size="sm" onClick={recalc} loading={recalculate.isPending}>
            <Calculator className="h-4 w-4" aria-hidden /> Recalculate
          </Button>
        </div>
      )}
      {sheet.missing > 0 && (
        <p className="mx-5 mt-3 rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger" role="alert">
          {sheet.missing === 1 ? "A material" : `${sheet.missing} materials`} in the recipe no longer exist, so the cost leaves
          {sheet.missing === 1 ? " it" : " them"} out. Edit the elastic to pick a material.
        </p>
      )}

      {sheet.lines.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-400">The recipe names no materials yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-y border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2 font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">g / m</th>
                <th className="px-3 py-2 text-right font-medium">Price / kg</th>
                <th className="px-5 py-2 text-right font-medium">Cost / m</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {sheet.lines.map((l, i) => <CostRow key={`${l.role}-${i}`} line={l} />)}
            </tbody>
            <tfoot className="border-t border-ink-200 tabular-nums">
              <tr>
                <td className="px-5 pt-3 text-ink-500" colSpan={3}>Materials</td>
                <td className="px-5 pt-3 text-right">{perMetre(sheet.now.materialCost)}</td>
              </tr>
              <tr>
                <td className="px-5 py-1 text-ink-500" colSpan={3}>Conversion</td>
                <td className="px-5 py-1 text-right">{perMetre(sheet.now.conversionCost)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="px-5 pb-4 pt-1" colSpan={3}>Total a metre</td>
                <td className="px-5 pb-4 pt-1 text-right text-base">{perMetre(sheet.now.totalCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editing && <EditPrices sheet={sheet} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function CostRow({ line }: { line: CostSheetLine }) {
  return (
    <tr>
      <td className="px-5 py-2.5">
        <p className="text-xs text-ink-400">{line.role}</p>
        {line.found ? (
          <Link to={`/materials/${line.material.id}`} className="font-medium hover:underline">{line.material.name}</Link>
        ) : (
          <span className="font-medium text-status-danger">{line.material.name}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">{line.grams}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {perKg(line.price)}
        {line.priceChanged && line.costedRate != null && (
          <span className="block text-xs text-status-warning" title="The price the last costing used">
            was {perKg(line.costedRate)}
          </span>
        )}
      </td>
      <td className="px-5 py-2.5 text-right tabular-nums">{perMetre(line.cost)}</td>
    </tr>
  );
}

/** The recipe's materials, once each, with every role they fill and their grams. */
function materialsOf(sheet: CostSheet) {
  const by = new Map<string, { id: string; name: string; roles: string[]; grams: number; price: number | null; sharedWith: number; found: boolean }>();
  for (const l of sheet.lines) {
    const m = by.get(l.material.id) ?? { id: l.material.id, name: l.material.name, roles: [], grams: 0, price: l.price, sharedWith: l.sharedWith, found: l.found };
    m.roles.push(l.role);
    m.grams += l.grams;
    by.set(l.material.id, m);
  }
  return [...by.values()];
}

function EditPrices({ sheet, onClose }: { sheet: CostSheet; onClose: () => void }) {
  const { saveCostSheet } = useElasticMutations();
  const { toast } = useToast();
  const materials = useMemo(() => materialsOf(sheet), [sheet]);
  const [prices, setPrices] = useState<Record<string, string>>(
    () => Object.fromEntries(materials.map((m) => [m.id, m.price != null ? String(m.price) : ""]))
  );
  const [conversion, setConversion] = useState(String(sheet.now.conversionCost));
  const [reason, setReason] = useState("");
  const [others, setOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const changed = materials.filter((m) => m.found && Number.isFinite(num(prices[m.id])) && num(prices[m.id]) !== m.price);
  const shared = changed.filter((m) => m.sharedWith > 0);

  // What the new prices come to, before saving; the server works it out
  // again on save, the same way.
  const preview = useMemo(() => {
    let material = 0;
    for (const l of sheet.lines) {
      const p = num(prices[l.material.id] ?? "");
      if (Number.isFinite(p)) material += (p * l.grams) / 1000;
    }
    const conv = num(conversion);
    return { material, total: material + (Number.isFinite(conv) ? conv : 0) };
  }, [prices, conversion, sheet.lines]);

  const save = () => {
    setError(null);
    for (const m of materials.filter((x) => x.found)) {
      const p = num(prices[m.id]);
      if (!Number.isFinite(p) || p < 0) return setError(`Enter a price for ${m.name}, ₹0 or more a kg.`);
    }
    const conv = num(conversion);
    if (!Number.isFinite(conv) || conv < 0) return setError("Enter the conversion cost, ₹0 or more a metre.");
    saveCostSheet.mutate(
      {
        id: sheet.elasticId,
        body: {
          prices: changed.map((m) => ({ material: m.id, price: num(prices[m.id]) })),
          conversionCost: conv,
          reason: reason.trim() || undefined,
          recostOthers: others && shared.length > 0,
        },
      },
      {
        onSuccess: (r) => {
          const before = sheet.costed?.totalCost;
          const after = r.costing.totalCost;
          const moved = before != null && Math.abs(after - before) >= 0.00005 ? `${perMetre(before)} → ${perMetre(after)}` : perMetre(after);
          const extra = r.others.recosted ? ` ${r.others.recosted} other elastic${r.others.recosted === 1 ? "" : "s"} recalculated.` : "";
          toast(`Cost saved: ${moved} a metre.${extra}`, "success");
          if (r.others.failed.length) {
            toast(`${r.others.failed.length} other elastic${r.others.failed.length === 1 ? "" : "s"} could not be recalculated: ${r.others.failed.map((f) => f.name).join(", ")}`, "error");
          }
          onClose();
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the prices."),
      }
    );
  };

  return (
    <FormScreen open onClose={onClose} title={`Prices for ${sheet.name}`} width="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          A material&apos;s price is its price everywhere — on every elastic that uses it, and on the materials screen.
          The change is kept in its price history.
        </p>

        <ul className="space-y-3">
          {materials.map((m) => (
            <li key={m.id} className="rounded-xl border border-ink-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-xs text-ink-400">
                    {m.roles.join(", ")} · {m.grams} g/m
                    {m.sharedWith > 0 && ` · also in ${m.sharedWith} other elastic${m.sharedWith === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <Input
                    aria-label={`Price of ${m.name}, ₹ a kg`}
                    type="number"
                    step="0.01"
                    min={0}
                    value={prices[m.id] ?? ""}
                    disabled={!m.found}
                    onChange={(e) => setPrices((p) => ({ ...p, [m.id]: e.target.value }))}
                    hint="₹ / kg"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Input
          label="Conversion cost (₹ a metre)"
          type="number"
          step="0.01"
          min={0}
          value={conversion}
          onChange={(e) => setConversion(e.target.value)}
        />
        <Input
          label="Reason for the price change"
          placeholder="e.g. October revision from the supplier"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="Kept in each changed material's price history."
        />

        {shared.length > 0 && (
          <label className="flex items-start gap-2 rounded-lg bg-surface-muted p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={others} onChange={(e) => setOthers(e.target.checked)} />
            <span>
              Also recalculate the other elastics that use {shared.map((m) => m.name).join(", ")}, so their cost is on the new price too.
            </span>
          </label>
        )}

        <div className="rounded-lg bg-ink-100/60 p-3 text-sm tabular-nums" aria-live="polite">
          <div className="flex justify-between"><span className="text-ink-500">Materials</span><span>{perMetre(preview.material)}</span></div>
          <div className="flex justify-between font-semibold">
            <span>New total a metre</span>
            <span>{perMetre(preview.total)}</span>
          </div>
          {sheet.costed?.totalCost != null && (
            <p className="mt-1 text-xs text-ink-400">Now {perMetre(sheet.costed.totalCost)}</p>
          )}
        </div>

        {error && <p role="alert" className="rounded-lg bg-status-dangerBg px-3 py-2 text-sm text-status-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saveCostSheet.isPending}>
            <Calculator className="h-4 w-4" aria-hidden /> Save and recalculate
          </Button>
        </div>
      </div>
    </FormScreen>
  );
}
