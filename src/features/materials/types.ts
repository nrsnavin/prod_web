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
