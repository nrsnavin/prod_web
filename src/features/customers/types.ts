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
  pincode?: string;
  /** Two-digit GST state code; blank means "work it out from the GSTIN". */
  stateCode?: string;
  /** Credit control: 0 = no limit. */
  creditLimit?: number;
  maxOverdueDays?: number;
  purchase?: unknown[];
  accountant?: { name?: string; phoneNumber?: string };
  merchandiser?: { name?: string; phoneNumber?: string };
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
  pincode?: string;
  stateCode?: string;
  paymentTerms?: string;
  creditLimit?: number;
  maxOverdueDays?: number;
}

export interface CustomerListResult {
  customers: Customer[];
  total: number;
  page: number;
  pages: number;
}
