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
  conversionCost?: number;
  costing?: ElasticCosting;
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
}
