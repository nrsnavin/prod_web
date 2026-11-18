// Mirrors models/DocumentSettings.js on the backend.
export interface DocumentSettings {
  companyName: string;
  tagline: string;
  addressLines: string[];
  gstin: string;
  phone: string;
  email: string;
  website: string;
  footerNote: string;
  termsText: string;
  accentColor: string;
  logo: string; // base64 data URL or ""
  invoice?: InvoiceSettings;
}

/** Settings → Invoice. The GSP secrets never come back from the server. */
export interface InvoiceSettings {
  defaultHsn: string;
  defaultGstPercent: number;
  city: string;
  pincode: string;
  stateCode: string;
  bank: { name: string; account: string; ifsc: string; branch: string; upiId: string };
  declaration: string;
  gsp: {
    provider: string;
    baseUrl: string;
    username: string;
    clientId: string;
    /** Sent only when typed; blank keeps what is stored. */
    clientSecret?: string;
    password?: string;
    /** Server-set: a provider with credentials is connected. */
    configured?: boolean;
  };
  /**
   * A GSTIN lookup service for "Verify" on the customer and supplier
   * forms. Blank: the e-invoice provider above is asked instead.
   */
  gstinLookup?: {
    /** Its address, with {gstin} where the number goes (and {key}, if the key goes in the address). */
    url: string;
    /** The header that carries the key, when it goes in one. */
    headerName: string;
    /** Sent only when typed; blank keeps what is stored. */
    key?: string;
    /** Server-set: a key is stored. */
    keySet?: boolean;
  };
  /** Server-set: whether Verify can ask the GST system as things stand, and through whom. */
  gstinCheck?: { available: boolean; via: string };
}

export type DocumentSettingsInput = Partial<Omit<DocumentSettings, "invoice">> & { invoice?: Partial<InvoiceSettings> };
