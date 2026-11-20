// Mirrors models/PdfTemplate.js + services/pdf on the backend.

// pageNumber: "Page {{n}} of {{total}}" (its `text`), stamped on every page.
export type ElementType = "text" | "field" | "image" | "line" | "box" | "table" | "pageNumber";
export type Align = "left" | "right" | "center";
// currency: whole rupees as they are, paise where there are any.
// currency2: always to the paisa (a quotation's rate per metre).
export type CellFormat = "text" | "number" | "currency" | "currency2";

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
  // The ruled-form look of the built-in layouts. The designer has no
  // controls for these; they are kept as they came and saved back.
  headerColor?: string;
  bodyColor?: string;
  gridColor?: string;
  zebraBg?: string;
  grid?: boolean;
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
  /** What a line of this document's table can show (a challan has boxes and no rate). */
  rowFields?: DocTypeField[];
}

// A4 in PDF points — the coordinate system elements are stored in.
export const PAGE_PT = {
  A4: { portrait: [595.28, 841.89], landscape: [841.89, 595.28] },
  LETTER: { portrait: [612, 792], landscape: [792, 612] },
} as const;
