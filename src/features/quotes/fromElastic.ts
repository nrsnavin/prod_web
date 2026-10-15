import { Elastic, MaterialWeight } from "@/features/elastics/types";
import { MaterialRow, ProductLine, newKey, newProduct } from "./costing";

// ══════════════════════════════════════════════════════════════════
//  A QUOTATION LINE FROM AN ELASTIC ON THE BOOKS
//
//  "New quotation" from the elastic list's selection. Each elastic
//  becomes a product with its recipe as the costing sheet: weights from
//  the elastic, rates from today's material prices, conversion cost from
//  its cost sheet. Same sum as the elastic's own costing (rate × g / 1000),
//  so the quote starts at the cost the elastic page shows, then takes the
//  margin. Everything stays editable on the form.
// ══════════════════════════════════════════════════════════════════

const str = (n: number | undefined | null) => (n != null && Number.isFinite(n) && n > 0 ? String(n) : "");

function part(mw: MaterialWeight | undefined) {
  const m = mw?.id && typeof mw.id === "object" ? mw.id : null;
  return { name: m?.name ?? "", weight: str(mw?.weight), rate: str(m?.price) };
}

/** The spec line printed under the product name. */
export function elasticSpec(e: Elastic): string {
  return [
    e.weaveType && `Weave ${e.weaveType}`,
    e.testingParameters?.width && `${e.testingParameters.width} mm`,
    e.weight && `${e.weight} g/m`,
    e.noOfHook && `${e.noOfHook} hooks`,
    e.pick && `pick ${e.pick}`,
  ].filter(Boolean).join(" · ");
}

export function productFromElastic(e: Elastic): ProductLine {
  const fixed = (label: string, p: ReturnType<typeof part>): MaterialRow => ({
    key: newKey(), label, weightGrams: p.weight, ratePerKg: p.rate, fixed: true,
  });
  const warps = (e.warpYarn ?? []).map(part).filter((p) => p.weight || p.rate);
  const [firstWarp, ...moreWarps] = warps;
  const conversion = e.costing?.conversionCost ?? e.conversionCost;

  return {
    ...newProduct(),
    productName: e.name,
    productSpec: elasticSpec(e),
    elastic: e._id,
    // The sheet's four rows in their usual order; a second or third warp
    // yarn gets a row of its own, named, after them.
    materials: [
      fixed("Warp yarn", firstWarp ?? { name: "", weight: "", rate: "" }),
      fixed("Spandex covering", part(e.spandexCovering)),
      fixed("Warp spandex", part(e.warpSpandex)),
      fixed("Weft yarn", part(e.weftYarn)),
      ...moreWarps.map((p) => ({
        key: newKey(), label: `Warp yarn — ${p.name || "other"}`, weightGrams: p.weight, ratePerKg: p.rate,
      })),
    ],
    ...(conversion != null && Number.isFinite(conversion) ? { conversionCost: String(conversion) } : {}),
  };
}
