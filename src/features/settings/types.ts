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
}

export type DocumentSettingsInput = Partial<DocumentSettings>;
