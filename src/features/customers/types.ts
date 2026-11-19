/**
 * One of a customer's named contacts (purchase, accounts, merchandiser),
 * as the server keeps it: { name, mobile, email }. `phoneNumber` is not a
 * field of it — the customer page read that, and so never showed a number.
 */
export interface ContactPerson {
  name?: string;
  mobile?: string;
  email?: string;
  /** Older spelling; read if a record carries it, never written. */
  phoneNumber?: string;
}

/** "Meena · 98400 12345 · accounts@slg.in" — whatever of it was entered. */
export function contactLine(person?: ContactPerson | null): string | undefined {
  if (!person) return undefined;
  const parts = [person.name, person.mobile || person.phoneNumber, person.email]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export interface Customer {
  /** The ledger's name in Tally when it differs from `name`. */
  tallyName?: string;
  /**
   * Mongoose's document version. Sent back as `expectedVersion` when this
   * record is saved, so a save made from a stale screen is refused (409,
   * code VERSION_CONFLICT) rather than silently overwriting someone
   * else's edit.
   */
  __v?: number;
  _id: string;
  name: string;
  /** Soft-deleted: hidden from lists and pickers, never removed. */
  archived?: boolean;
  email?: string;
  gstin?: string;
  status?: string; // "Active" | "Inactive"
  contactName?: string;
  phoneNumber?: string;
  /** Billing address, as printed on challans and invoices. */
  address?: string;
  city?: string;
  /** The business's own grouping, for sales by customer group. */
  group?: string;
  pincode?: string;
  /** Two-digit GST state code; blank means "work it out from the GSTIN". */
  stateCode?: string;
  /** Credit control: 0 = no limit. */
  creditLimit?: number;
  maxOverdueDays?: number;
  /** For TDS the customer deducts from us: their TAN matches Form 26AS; PAN for the record. */
  tan?: string;
  pan?: string;
  /** Interest on overdue invoices (% a year) and grace days; null takes the books' setting. */
  interestRate?: number | null;
  interestGraceDays?: number | null;
  /** Export: the country and currency; an SEZ unit is zero-rated too. */
  country?: string;
  sez?: boolean;
  currency?: string;
  purchase?: ContactPerson;
  accountant?: ContactPerson;
  merchandiser?: ContactPerson;
  paymentTerms?: string;
  createdAt?: string;
}

export interface CustomerFormValues {
  /** The ledger's name in Tally when it differs from `name`. */
  tallyName?: string;
  /** Set when the form was filled from a card: the AI ledger row the save settles. */
  aiSuggestion?: string;
  name: string;
  contactName?: string;
  phoneNumber?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  /** The business's own grouping, for sales by customer group. */
  group?: string;
  pincode?: string;
  stateCode?: string;
  paymentTerms?: string;
  creditLimit?: number;
  maxOverdueDays?: number;
  tan?: string;
  pan?: string;
  interestRate?: number | "" | null;
  interestGraceDays?: number | "" | null;
  country?: string;
  sez?: boolean;
  currency?: string;
}

export interface CustomerListResult {
  customers: Customer[];
  total: number;
  page: number;
  pages: number;
}
