// ── The category list used to live HERE, hardcoded ────────────────
//
//   export const MATERIAL_CATEGORIES = ["warp", "weft", "Rubber", "covering"]
//
// It was one of eight copies across three repos that did not agree: the
// Flutter app also offered "Chemicals", and the server matched four
// literals by exact string. So a material entered on the phone as
// "Chemicals" could not be created here and matched no filter chip, and
// changing the case of "Rubber" anywhere silently emptied the elastic
// recipe picker with no error at all.
//
// The list now comes from the server — see features/materialGroups.

export interface StockMovement {
  date: string;
  type: string; // inward | outward | adjustment...
  // The detail endpoint populates this (`.populate("stockMovements.order",
  // "orderNo")`), so it arrives as an object, not an id. Typed as `string`
  // it was rendered straight into JSX and crashed the page with React
  // error #31 — "objects are not valid as a React child".
  order?: string | { _id: string; orderNo?: number } | null;
  /**
   * The purchase order behind a goods receipt. `order` above is
   * ref:"Order" and could never hold one, which is why every receipt on
   * this ledger used to carry no reference at all.
   */
  purchaseOrder?: string | { _id: string; poNo?: number } | null;
  /** What stock ACTUALLY moved by — never what was asked for. */
  quantity: number;
  balance?: number;
  /**
   * What was asked for, present only when it differs from `quantity`.
   * Stock floors at zero, so a write-off of 50 against 30 on hand moves
   * 30; the row used to record the 50 and the ledger stopped adding up.
   */
  requested?: number;
  /** What one unit was worth when it moved, snapshotted on the row. */
  unitCost?: number;
  /** |quantity| × unitCost, from the server. null when no cost was recorded. */
  value?: number | null;
  /** requested − quantity, when the movement was clamped. null otherwise. */
  shortfall?: number | null;
  /** What the person typed. Only manual adjustments have one. */
  reason?: string;

  // ── Said in words by the server (utils/stockLedger.js) ──────────────
  // Computed there rather than here so the material page, the report and
  // anything added later phrase the same movement identically.
  /** "Goods received", "Order approved" — not the raw enum. */
  typeLabel?: string;
  /** "PO #55" / "Order #1042", or null when nothing identifies it. */
  reference?: string | null;
  referenceKind?: "order" | "purchaseOrder" | null;
  referenceId?: string | null;
  /**
   * true when the reference was matched back from the inward history
   * rather than recorded on the row at the time — receipts predating
   * the PO field. A reconstruction and a record are not the same claim.
   */
  referenceDerived?: boolean;
}

/**
 * What the server did when asked to remove a master record.
 *
 * A material nothing has used is deleted. One named by an order, a PO,
 * a goods receipt or an elastic's recipe is archived instead — deleting
 * it would leave every one of those pointing at nothing. The caller has
 * to be told which, or the screen reports a deletion that never
 * happened and the row reappears on the next refresh.
 */
export interface RemoveResult {
  success: boolean;
  archived: boolean;
  deleted: boolean;
  message: string;
  /** Where it is used, when that is why it was archived. */
  usage?: Array<{ label: string; count: number }>;
}

export interface RawMaterial {
  _id: string;
  name: string;
  /**
   * The group's NAME, denormalised onto the material.
   *
   * Still the field every existing reader uses — the MRP sheet, the
   * forecast, stock-count scope, the mobile chips. The server rewrites
   * it on every member when a group is renamed, so it cannot drift from
   * `group` below.
   */
  category: string;
  /**
   * The link. Populated with name/colour/kind by the list endpoint;
   * null on a material that predates groups or names a category no
   * group carries.
   */
  group?: { _id: string; name: string; colour?: string; kind?: string } | string | null;
  /**
   * Unit of measure. Defaults to kg — which is what every price in this
   * system is denominated in. The server read `m.unit || ""` for years
   * before the field existed, so this used to always come back empty.
   */
  unit?: string;
  supplier?: { _id: string; name: string } | string | null;
  /** The LATEST purchase price — what a new PO defaults to. */
  price: number;
  /**
   * The weighted average of what the stock on hand actually cost, and
   * what issues are costed at. 0 means the material has not been
   * received since averaging existed; readers fall back to `price`
   * there, which is what everything used to be costed at anyway.
   */
  avgCost?: number;
  /** avgCost with the price fallback already applied, from the server. */
  unitCost?: number;
  /** stock × unitCost, from the server, so every client shows one figure. */
  stockValue?: number;
  stock: number;
  minStock: number;
  totalConsumption?: number;
  /**
   * Soft-deleted: out of the pickers, but every reference to it still
   * resolves. Legacy rows have no value at all, so treat undefined as
   * active — never compare against `false`.
   */
  archived?: boolean;
  archivedAt?: string;
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
  /**
   * Stock that exists but sits in no lot — the pool a hand-opened lot may
   * draw on. Zero when lots already account for everything (or, in the
   * window between order approval and batch issue, for more).
   */
  unplacedQty?: number;
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

  // ── How long it has sat on the rack ─────────────────────────────────
  // Dyed yarn is not indefinitely interchangeable with itself: the lot
  // that has been there longest is the one to use up first, and the one
  // to look at when a shade complaint arrives.
  /** Whole days since it was received. */
  ageDays?: number | null;
  /**
   * null on a lot that holds nothing — an exhausted lot's age is
   * history, and listing it as critical would bury the ones that matter.
   */
  ageBucket?: "fresh" | "watch" | "late" | "critical" | null;
  /** Only on the detail read — see GET /yarn-lots/:id. */
  movements?: LotMovement[];
}

/**
 * One move on a lot's own ledger.
 *
 * `quantity` is the delta, so a draw is negative — the same convention
 * as the raw material ledger, deliberately, so the two cannot be read
 * with opposite sign rules.
 */
export interface LotMovement {
  date: string;
  type: "INWARD" | "BATCH_ISSUE" | "BATCH_RETURN" | "ADJUST" | string;
  /** Said in words by the server; the raw type is a database value. */
  typeLabel?: string;
  quantity: number;
  balance?: number;
  /** The batch that drew or returned it, when there was one. */
  reference?: string | null;
  referenceId?: string | null;
  /** Only an adjustment has one — the rest are explained by their document. */
  reason?: string;
  /** Who made the adjustment. */
  by?: string | null;
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
  /**
   * A MaterialGroup id, or the sentinel `name:<category>` for a material
   * whose category no group carries — every material until the migration
   * runs, and any written by an older client after it. api.ts unpacks
   * the sentinel so saving such a material leaves it where it was rather
   * than silently reassigning it.
   */
  group: string;
  category?: string;
  unit?: string;
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
