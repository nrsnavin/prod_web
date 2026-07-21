export const MATERIAL_CATEGORIES = ["warp", "weft", "Rubber", "covering"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export interface StockMovement {
  date: string;
  type: string; // inward | outward | adjustment...
  order?: string;
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
