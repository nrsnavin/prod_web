export const MATERIAL_CATEGORIES = ["warp", "weft", "Rubber", "covering"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export interface StockMovement {
  date: string;
  type: string; // inward | outward | adjustment...
  // The detail endpoint populates this (`.populate("stockMovements.order",
  // "orderNo")`), so it arrives as an object, not an id. Typed as `string`
  // it was rendered straight into JSX and crashed the page with React
  // error #31 — "objects are not valid as a React child".
  order?: string | { _id: string; orderNo?: number } | null;
  quantity: number;
  balance?: number;
  reason?: string;
}

export interface RawMaterial {
  _id: string;
  name: string;
  category: string;
  supplier?: { _id: string; name: string } | string | null;
  price: number;
  stock: number;
  minStock: number;
  totalConsumption?: number;
  stockMovements?: StockMovement[];
  inwards?: Array<{
    _id: string;
    quantity: number;
    inwardDate?: string;
    createdAt?: string;
    remarks?: string;
  }>;
  outwards?: Array<{
    _id: string;
    quantity: number;
    date?: string;
    createdAt?: string;
  }>;
  lots?: YarnLot[];
}

// ── Dye lots ────────────────────────────────────────────────────────────
// A lot is a bucket of one material, dyed together and so of one shade.
// Its balance is deliberately NOT a subdivision that adds up to
// `RawMaterial.stock`: stock is debited at order approval, a lot is drawn
// when the yarn physically leaves the rack for a warping batch. See
// prod/models/YarnLot.js.
export type YarnLotStatus = "open" | "exhausted" | "quarantined" | "closed";

export interface YarnLot {
  _id: string;
  rawMaterial: { _id: string; name: string; category?: string } | string;
  lotNo: string;
  shade?: string;
  dyer?: string;
  supplier?: { _id: string; name: string } | string | null;
  receivedDate?: string;
  receivedQty: number;
  consumedQty: number;
  /** Virtual on the server — receivedQty − consumedQty, never negative. */
  balance: number;
  status: YarnLotStatus;
  remarks?: string;
}

/** One hop of a lot's forward trail — see GET /yarn-lots/:id/trace. */
export interface LotTraceEntry {
  batchId: string;
  batchNo: string;
  status: "planned" | "issued" | "completed" | "cancelled";
  beamNos: number[];
  issuedDate?: string;
  completedDate?: string;
  quantity: number;
  job: { _id: string; jobOrderNo: number; status?: string } | null;
  order: { _id: string; orderNo?: number; po?: string; customer: string | null } | null;
}

export interface LotTrace {
  lot: YarnLot;
  batches: LotTraceEntry[];
  issuedQty: number;
}

export interface MaterialFormValues {
  name: string;
  category: string;
  supplier?: string;
  stock?: number;
  minStock?: number;
  price?: number;
}

export interface SupplierOption {
  _id: string;
  name: string;
}

// Mirrors POST /materials/bulk-update-prices (prod/api/rawMaterial.js)
export interface BulkPriceResult {
  success: boolean;
  message: string;
  updated: number;
  skipped: number;
  results: Array<{
    _id: string;
    name: string;
    oldPrice: number;
    newPrice: number;
    change: number;
  }>;
}

// Mirrors GET /materials/replenishment-forecast (prod/api/rawMaterial.js)
export interface ForecastLine {
  _id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  onHand: number;
  minStock: number;
  runRatePerDay: number;
  committedDemand: number;
  projectedConsumption: number;
  projectedStock: number;
  daysToStockout: number | null;
  projectedStockoutDate: string | null;
  suggestedQty: number;
  estimatedCost: number;
  severity: "critical" | "warn";
  supplier: { _id: string; name: string };
}

export interface ForecastSupplierGroup {
  supplier: { _id: string; name: string };
  lines: ForecastLine[];
  estimatedCost: number;
}

export interface ReplenishmentForecast {
  success: boolean;
  horizonDays: number;
  lookbackDays: number;
  totals: { flagged: number; critical: number; suppliers: number; estimatedCost: number };
  materials: ForecastLine[];
  bySupplier: ForecastSupplierGroup[];
  skippedNoSupplier: number;
  aiSummary: string | null;
  aiGenerated: boolean;
}
