// Shapes returned by /api/v2/pnl. Mirrors services/orderPnl.js on the
// server — every figure here is DERIVED on read from the documents that
// already exist, so nothing in this file is ever posted back except the
// three inputs the P&L needs and no other screen owns: selling rates,
// per-job cost overrides, and the ₹/meter rate card.

export interface PnlRevenueLine {
  elasticId: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface PnlCosts {
  material: number;
  labour: number;
  jobWork: number;
  finishing: number;
  checking: number;
  packing: number;
  overhead: number;
  total: number;
}

/** `basis` says whether the figure came off the rate card or a job override. */
export interface PnlConversionLine {
  amount: number;
  basis: "rate" | "override";
}

export interface PnlJobRow {
  id: string;
  jobOrderNo: number | null;
  jobNo: string;
  status: string;
  productionMode: "in_house" | "outsource";
  outsourceVendor: string;
  producedMeters: number;
  labour: { amount: number; shifts: number; hours: number; openShifts: number };
  jobWork: number;
  finishing: PnlConversionLine;
  checking: PnlConversionLine;
  packing: PnlConversionLine;
  overhead: PnlConversionLine;
  total: number;
  costPerMeter: number | null;
}

export interface PnlMaterialLine {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: string;
}

export interface OrderPnl {
  order: {
    id: string;
    orderNo: number | null;
    po: string;
    status: string;
    date: string | null;
    supplyDate: string | null;
    customerName: string;
  };
  revenue: {
    lines: PnlRevenueLine[];
    orderValue: number;
    invoiced: { amount: number; quantity: number; challans: number };
  };
  costs: PnlCosts;
  jobs: PnlJobRow[];
  totals: {
    producedMeters: number;
    orderedQuantity: number;
    profit: number;
    /** null when the order carries no price — unknown, not -100%. */
    marginPct: number | null;
    costPerMeter: number | null;
    revenuePerMeter: number | null;
  };
  rateCard: CostRateCard & { configured: boolean };
  materialLines: PnlMaterialLine[];
  warnings: string[];
}

export interface PnlListRow {
  id: string;
  orderNo: number | null;
  po: string;
  status: string;
  date: string | null;
  supplyDate: string | null;
  customerName: string;
  orderValue: number;
  invoiced: number;
  cost: number;
  costs: PnlCosts;
  profit: number;
  marginPct: number | null;
  producedMeters: number;
  jobs: number;
  warnings: number;
}

export type PnlSort = "recent" | "margin" | "profit" | "value";

export interface PnlListPage {
  rows: PnlListRow[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  sort: PnlSort;
  /** "page" when the ranking only ordered the fetched page. */
  sortScope: "all" | "page";
  totals: { orderValue: number; cost: number; profit: number };
}

export interface CostRateCard {
  finishingRatePerMeter: number;
  checkingRatePerMeter: number;
  packingRatePerMeter: number;
  overheadRatePerMeter: number;
}

export interface CostSettings extends CostRateCard {
  notes: string;
  configured: boolean;
  updatedAt: string | null;
}

/** null clears an override and hands the line back to the rate card. */
export interface JobCostOverrides {
  finishing?: number | null;
  checking?: number | null;
  packing?: number | null;
  overhead?: number | null;
  notes?: string;
}
