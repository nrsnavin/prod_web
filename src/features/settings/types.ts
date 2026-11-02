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
  bank: { name: string; account: string; ifsc: string; branch: string };
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
}

export type DocumentSettingsInput = Partial<Omit<DocumentSettings, "invoice">> & { invoice?: Partial<InvoiceSettings> };
