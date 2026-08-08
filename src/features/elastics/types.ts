export interface MaterialRef {
  _id: string;
  name: string;
  price?: number;
  category?: string;
}

export interface MaterialWeight {
  id?: MaterialRef | string | null;
  weight?: number;
}

export interface ElasticCosting {
  totalCost?: number;
  materialCost?: number;
  conversionCost?: number;
  details?: Array<{ name?: string; cost?: number; weight?: number }>;
}

/** A section of a beam in the elastic's warping template. */
export interface TemplateSection {
  warpYarn?: MaterialRef | string | null;
  ends?: number;
  maxMeters?: number;
}
export interface TemplateBeam {
  beamNo?: number;
  totalEnds?: number;
  sections?: TemplateSection[];
}
/**
 * How this elastic is warped, recorded once on the product rather than
 * re-entered per job. The warping plan starts from a copy of it.
 */
export interface WarpingPlanTemplate {
  noOfBeams?: number;
  beams?: TemplateBeam[];
}

/**
 * Physical test values for the product. Set on the mobile app and shown
 * on the detail page; the web form does not edit them, but a clone still
 * has to carry them or it produces a product that looks identical and
 * tests differently.
 */
export interface ElasticTestingParameters {
  width?: number;
  elongation?: number;
  recovery?: number;
  /** Spelled `strech` in the schema — kept as-is rather than silently renamed. */
  strech?: string;
}

export interface Elastic {
  _id: string;
  name: string;
  /** Soft-deleted / inactive — hidden from lists and pickers by default. */
  archived?: boolean;
  weaveType?: string;
  image?: string;
  warpSpandex?: MaterialWeight;
  spandexCovering?: MaterialWeight;
  weftYarn?: MaterialWeight;
  warpYarn?: MaterialWeight[];
  spandexEnds?: number;
  yarnEnds?: number;
  pick?: number;
  noOfHook?: number;
  weight?: number;
  quantityProduced?: number;
  stock?: number;
  minStock?: number;
  reservedStock?: number;
  conversionCost?: number;
  costing?: ElasticCosting;
  testingParameters?: ElasticTestingParameters;
  warpingPlanTemplate?: WarpingPlanTemplate | null;
  createdAt?: string;
}

export interface MaterialsByCategory {
  warp: MaterialRef[];
  weft: MaterialRef[];
  rubber: MaterialRef[];
  covering: MaterialRef[];
}

export interface ElasticFormValues {
  name: string;
  weaveType?: string;
  warpSpandex: { id: string; weight: number };
  spandexCovering: { id: string; weight: number };
  weftYarn: { id: string; weight: number };
  warpYarn: Array<{ id: string; weight: number }>;
  spandexEnds?: number;
  yarnEnds?: number;
  pick?: number;
  noOfHook?: number;
  weight?: number;
  conversionCost?: number;
  /** Omitted entirely when the form left the template empty. */
  warpingPlanTemplate?: { beams: Array<{ beamNo: number; sections: Array<{ warpYarn: string; ends: number; maxMeters: number }> }> };
}

/**
 * What is POSTed to create an elastic: everything the form collects,
 * plus the fields it cannot edit but a clone carries anyway.
 */
export type ElasticCreateBody = ElasticFormValues & {
  testingParameters?: ElasticTestingParameters;
  minStock?: number;
};

// ── Where this elastic has been ──────────────────────────────────────────
// The stock card says how much there is. These say who bought it and when
// it was last run — the questions asked when a customer rings up about a
// product rather than about a number.
//
// Every quantity is THIS elastic's line off a shared document. An order
// carrying four products would otherwise report the other three as this
// one's, and 1,800 is a believable enough figure that nobody would catch it.
export interface ElasticOrderRow {
  id: string;
  orderNo: number | null;
  po: string;
  date: string | null;
  supplyDate: string | null;
  status: string;
  customerId: string | null;
  customerName: string;
  ordered: number;
  produced: number;
  packed: number;
}

export interface ElasticJobRow {
  id: string;
  jobOrderNo: number | null;
  jobNo: string;
  date: string | null;
  status: string;
  orderId: string | null;
  orderNo: number | null;
  customerName: string;
  planned: number;
  produced: number;
  packed: number;
  wastage: number;
}

export interface ElasticHistoryPage<T> {
  elastic: { _id: string; name: string };
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  orders?: T[];
  jobs?: T[];
}
