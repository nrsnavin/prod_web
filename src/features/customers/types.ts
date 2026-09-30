export interface Customer {
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
  purchase?: unknown[];
  accountant?: { name?: string; phoneNumber?: string };
  merchandiser?: { name?: string; phoneNumber?: string };
  paymentTerms?: string;
  createdAt?: string;
}

export interface CustomerFormValues {
  name: string;
  contactName?: string;
  phoneNumber?: string;
  email?: string;
  gstin?: string;
  paymentTerms?: string;
}

export interface CustomerListResult {
  customers: Customer[];
  total: number;
  page: number;
  pages: number;
}
