// ══════════════════════════════════════════════════════════════════
//  THE PDF DESIGNER, OPENED ON A BUILT-IN LAYOUT
//
//  The built-in layouts carry things the designer did not know about:
//  a page-number element, a column that prints to the paisa, and — on a
//  challan — the "unit" and "boxes" columns.
//
//    • the page number shows on the canvas and its wording can be edited
//    • a column's field and format show what they are, not the first
//      option in the list (a "unit" column read "sno", a paise column
//      read "text")
//    • saving sends the layout back whole: page number, column rules and
//      header colours included
// ══════════════════════════════════════════════════════════════════
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { DocType, PdfTemplate } from "./types";

const svc = vi.hoisted(() => ({ docTypes: vi.fn(), get: vi.fn(), save: vi.fn(), preview: vi.fn() }));
vi.mock("./api", () => ({ pdfTemplateService: svc }));
vi.mock("@/components/ui/Toast", async (orig) => ({ ...(await orig<object>()), useToast: () => ({ toast: vi.fn() }) }));

import { PdfDesignerPage } from "./PdfDesignerPage";

const docTypes: DocType[] = [{
  id: "delivery-challan", label: "Delivery Challan",
  fields: [{ key: "companyName", label: "Company name" }],
  rowFields: [
    { key: "sno", label: "S.No" }, { key: "description", label: "Description of Goods" },
    { key: "unit", label: "UOM" }, { key: "boxes", label: "Boxes" }, { key: "qty", label: "Quantity" },
  ],
}];

const builtIn = (): PdfTemplate => ({
  docType: "delivery-challan", name: "Delivery Challan", pageSize: "A4", orientation: "portrait", enabled: false,
  elements: [
    { id: "company", type: "field", field: "companyName", x: 120, y: 40, w: 300, h: 20, fontSize: 15, bold: true, color: "#111111" },
    {
      id: "table", type: "table", x: 34, y: 236, w: 527, h: 420, fontSize: 8.5,
      headerBg: "#E4E4E4", headerColor: "#111111", bodyColor: "#111111", gridColor: "#999999", grid: true, zebra: false,
      columns: [
        { field: "sno", header: "S.No", width: 0.6, align: "left", format: "text" },
        { field: "unit", header: "UOM", width: 0.9, align: "center", format: "text" },
        { field: "boxes", header: "Boxes", width: 0.9, align: "right", format: "number" },
        { field: "qty", header: "Quantity", width: 1.3, align: "right", format: "currency2" },
      ],
    },
    { id: "pageno", type: "pageNumber", text: "Page {{n}} of {{total}}", x: 380, y: 818, w: 181, h: 10, fontSize: 7, align: "right", color: "#555555" },
  ],
});

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
);

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.docTypes.mockResolvedValue(docTypes);
  svc.get.mockResolvedValue(builtIn());
  svc.save.mockImplementation(async (_d: string, t: PdfTemplate) => t);
});

describe("the PDF designer on a built-in layout", () => {
  it("shows the page number and lets its wording be changed", async () => {
    render(wrap(<PdfDesignerPage />));
    const stamp = await screen.findByText("Page {{n}} of {{total}}");
    fireEvent.pointerDown(stamp);
    const wording = await screen.findByLabelText("Page number wording");
    expect(wording).toHaveValue("Page {{n}} of {{total}}");
    fireEvent.change(wording, { target: { value: "Sheet {{n}} / {{total}}" } });
    expect(await screen.findByText("Sheet {{n}} / {{total}}")).toBeInTheDocument();
    // One page number a sheet: a second cannot be added while this one is there.
    expect(screen.getByRole("button", { name: /page no/i })).toBeDisabled();
  });

  it("shows a column's own field and format", async () => {
    render(wrap(<PdfDesignerPage />));
    fireEvent.pointerDown(await screen.findByText(/▦ Table/));
    const fields = (await screen.findAllByLabelText("Column field")) as HTMLSelectElement[];
    expect(fields.map((s) => s.value)).toEqual(["sno", "unit", "boxes", "qty"]);
    // The value is one of the options offered, so the box shows it.
    for (const s of fields) expect([...s.options].map((o) => o.value)).toContain(s.value);
    expect([...fields[0].options].map((o) => o.value)).toEqual(["sno", "description", "unit", "boxes", "qty"]);
    const formats = screen.getAllByLabelText("Column format") as HTMLSelectElement[];
    expect(formats[3].value).toBe("currency2");
    expect([...formats[3].options].map((o) => o.value)).toContain("currency2");
  });

  it("saves the layout back whole when it is switched on", async () => {
    render(wrap(<PdfDesignerPage />));
    fireEvent.click(await screen.findByRole("checkbox", { name: /use this template/i }));
    fireEvent.click(screen.getByRole("button", { name: /save template/i }));
    await waitFor(() => expect(svc.save).toHaveBeenCalledTimes(1));
    const [docType, sent] = svc.save.mock.calls[0] as [string, PdfTemplate];
    expect(docType).toBe("delivery-challan");
    expect(sent.enabled).toBe(true);
    expect(sent.elements).toEqual(builtIn().elements);
  });
});
