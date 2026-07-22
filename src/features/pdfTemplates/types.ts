// Mirrors models/PdfTemplate.js + services/pdf on the backend.

export type ElementType = "text" | "field" | "image" | "line" | "box" | "table";
export type Align = "left" | "right" | "center";
export type CellFormat = "text" | "number" | "currency";

export interface TemplateColumn {
  field: string;
  header: string;
  width: number;
  align: Align;
  format: CellFormat;
}

export interface TemplateElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  // text / field
  text?: string;
  field?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: Align;
  color?: string;
  // line / box
  lineWidth?: number;
  fill?: string;
  // table
  columns?: TemplateColumn[];
  headerBg?: string;
  zebra?: boolean;
}

export interface PdfTemplate {
  docType: string;
  name?: string;
  pageSize: "A4" | "LETTER";
  orientation: "portrait" | "landscape";
  enabled: boolean;
  elements: TemplateElement[];
}

export interface DocTypeField {
  key: string;
  label: string;
}
export interface DocType {
  id: string;
  label: string;
  fields: DocTypeField[];
}

// A4 in PDF points — the coordinate system elements are stored in.
export const PAGE_PT = {
  A4: { portrait: [595.28, 841.89], landscape: [841.89, 595.28] },
  LETTER: { portrait: [612, 792], landscape: [792, 612] },
} as const;
