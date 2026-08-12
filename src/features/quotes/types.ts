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

  productName: string;
  productSpec?: string;

  materials: QuoteMaterial[];

  totalWeightGrams: number;
  materialCost: number;
  conversionCost: number;
  totalCost: number;
  marginPercent: number;
  marginAmount: number;
  rateBeforeTax: number;
  gstPercent: number;
  gstAmount: number;
  rateInclTax: number;

  quantityMetres: number;
  valueBeforeTax: number;
  valueInclTax: number;

  remarks?: string;
  status: QuoteStatus;
  createdAt?: string;
}

/** What the create/update endpoints accept. Totals are never sent — the
 *  server prices every quote from these figures itself. */
export interface QuoteWriteBody {
  customerName: string;
  customerAddress?: string;
  customerGstin?: string;
  customerRef?: string;
  productName: string;
  productSpec?: string;
  date?: string;
  validTill?: string;
  remarks?: string;
  materials: Array<{ label: string; weightGrams: number; ratePerKg: number }>;
  conversionCost: number;
  marginPercent: number;
  gstPercent: number;
  quantityMetres: number;
}
