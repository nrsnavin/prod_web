import { Elastic, ElasticCreateBody, ElasticFormValues } from "./types";

// Cloning an elastic.
//
// Most new products in this business are a variation on an existing one:
// same yarns, same warping build, a different width or pick. Re-entering
// eleven fields and a beam template to change one of them is where typos
// come from, and a typo in a composition is a costing that is wrong for
// as long as nobody checks it.
//
// So a clone carries the SPECIFICATION and nothing about the POSITION.
// Stock, produced quantity and reservations belong to the elastic that
// earned them; carrying them would invent stock that no ledger accounts
// for, which is the one thing a stock system must never do.
//
// The name is deliberately left EMPTY rather than suffixed "(Copy)" —
// the form requires one, so a blank field is the thing that stops a
// clone being saved unnamed, and the person cloning always knows what
// they meant to call it.

/**
 * The source's specification, ready to prefill the create form.
 *
 * Built field by field rather than by spreading the source, so a field
 * added to Elastic later has to be considered here before it rides along
 * into a clone.
 */
export function cloneInitial(source: Elastic): Elastic {
  return {
    _id: "",
    name: "",
    weaveType: source.weaveType,
    warpSpandex: source.warpSpandex,
    spandexCovering: source.spandexCovering,
    weftYarn: source.weftYarn,
    warpYarn: source.warpYarn,
    spandexEnds: source.spandexEnds,
    yarnEnds: source.yarnEnds,
    pick: source.pick,
    noOfHook: source.noOfHook,
    weight: source.weight,
    // The form reads conversionCost from either place.
    conversionCost: source.conversionCost ?? source.costing?.conversionCost,
    warpingPlanTemplate: source.warpingPlanTemplate,
  };
}

/**
 * The details the web form cannot edit but the product still has.
 *
 * Testing parameters are set on the mobile app and shown on the detail
 * page; dropping them on a clone would quietly produce a product that
 * looks identical and tests differently. minStock is a property of the
 * product, not a position — the level at which THIS item is worth
 * reordering.
 */
export function cloneExtras(source: Elastic): Partial<ElasticCreateBody> {
  const extras: Partial<ElasticCreateBody> = {};
  if (source.testingParameters) extras.testingParameters = { ...source.testingParameters };
  if (typeof source.minStock === "number") extras.minStock = source.minStock;
  return extras;
}

/** The create payload for a clone: what was typed, plus what was carried. */
export const cloneBody = (values: ElasticFormValues, source: Elastic): ElasticCreateBody => ({
  ...values,
  ...cloneExtras(source),
});
