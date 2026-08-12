export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface QuoteMaterial {
  label: string;
  weightGrams: number;
  ratePerKg: number;
  cost: number;
}

export interface QuoteLine {
  elastic?: string;
  productName: string;
  productSpec?: string;
  materials: QuoteMaterial[];
  conversionCost: number;
  marginPercent: number;
  quantityMetres: number;

  totalWeightGrams: number;
  materialCost: number;
  totalCost: number;
  marginAmount: number;
  rateBeforeTax: number;
  gstAmount: number;
  rateInclTax: number;
  valueBeforeTax: number;
  valueInclTax: number;
}

export interface Quote {
  _id: string;
  quoteNo: string;
  financialYear: string;
  sequence: number;
  date: string;
  validTill: string;

  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerRef?: string;

  customerPhone?: string;

  lines: QuoteLine[];

  gstPercent: number;
  subTotal: number;
  gstAmount: number;
  grandTotal: number;
  totalQuantityMetres: number;

  remarks?: string;
  status: QuoteStatus;
  createdAt?: string;
}

/** What the create/update endpoints accept. Totals are never sent — the
 *  server prices every quote from these figures itself. */
export interface QuoteWriteLine {
  elastic?: string;
  productName: string;
  productSpec?: string;
  materials: Array<{ label: string; weightGrams: number; ratePerKg: number }>;
  conversionCost: number;
  marginPercent: number;
  quantityMetres: number;
}

/** What the create/update endpoints accept. Totals are never sent — the
 *  server prices every quote from these figures itself. */
export interface QuoteWriteBody {
  /** The master record, when one was picked. Optional by design: a quote
   *  often goes to somebody who is not a customer yet. */
  customer?: string;
  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerPhone?: string;
  customerRef?: string;
  date?: string;
  validTill?: string;
  remarks?: string;
  lines: QuoteWriteLine[];
  gstPercent: number;
}
