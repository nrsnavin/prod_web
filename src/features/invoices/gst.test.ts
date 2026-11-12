import { describe, expect, it } from "vitest";
import { draftLines, priceLines, round2, stateCodeFromGstin } from "./gst";
import type { InvoiceDcOption, InvoiceDraftLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE PREVIEW ARITHMETIC — the same as services/gst.js on the server,
//  so what the dialog shows is what the invoice says.
// ══════════════════════════════════════════════════════════════════

const dc = (id: string, items: Array<[string, string, number]>): InvoiceDcOption => ({
  _id: id, dcNumber: `E-26/27-${id}`, status: "dispatched", totalQuantity: items.reduce((a, i) => a + i[2], 0),
  invoicedOn: null, eligible: true,
  items: items.map(([elastic, elasticName, quantity]) => ({ elastic, elasticName, quantity, unit: "m" })),
});
const proposed: InvoiceDraftLine[] = [
  { elastic: "a", name: "20mm Knitted", unit: "m", quantity: 1000, rate: 12.5, hsn: "5806", gstPercent: 5, dcNumbers: [], rateSource: "order" },
  { elastic: "b", name: "38mm Woven", unit: "m", quantity: 300, rate: 40, hsn: "5604", gstPercent: 12, dcNumbers: [], rateSource: "order" },
];
const defaults = { hsn: "5806", gstPercent: 5 };

describe("draftLines", () => {
  const dcs = [dc("0001", [["a", "20mm Knitted", 600]]), dc("0002", [["a", "20mm Knitted", 400], ["b", "38mm Woven", 300]])];

  it("merges the ticked challans' items per product and names the challans", () => {
    const lines = draftLines(dcs, new Set(["0001", "0002"]), proposed, {}, defaults);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ elastic: "a", quantity: 1000, rate: 12.5, hsn: "5806", gstPercent: 5, dcNumbers: ["E-26/27-0001", "E-26/27-0002"] });
    expect(lines[1]).toMatchObject({ elastic: "b", quantity: 300, rate: 40, hsn: "5604", gstPercent: 12 });
  });

  it("unticking a challan takes its quantity out", () => {
    const lines = draftLines(dcs, new Set(["0001"]), proposed, {}, defaults);
    expect(lines).toEqual([expect.objectContaining({ elastic: "a", quantity: 600, dcNumbers: ["E-26/27-0001"] })]);
  });

  it("a typed rate, HSN or GST % wins over the proposal; a blank rate falls back", () => {
    const lines = draftLines(dcs, new Set(["0002"]), proposed, { a: { elastic: "a", rate: 10, hsn: "58063990" }, b: { elastic: "b", rate: "", gstPercent: 18 } }, defaults);
    expect(lines[0]).toMatchObject({ rate: 10, hsn: "58063990", rateSource: "entered" });
    expect(lines[1]).toMatchObject({ rate: 40, gstPercent: 18, rateSource: "order" });
  });

  it("an item of an elastic the server did not propose takes the Settings defaults", () => {
    const lines = draftLines([dc("0009", [["z", "Odd one", 10]])], new Set(["0009"]), proposed, {}, defaults);
    expect(lines[0]).toMatchObject({ name: "Odd one", rate: 0, hsn: "5806", gstPercent: 5, rateSource: "none" });
  });
});

describe("priceLines", () => {
  const lines = draftLines([dc("1", [["a", "20mm Knitted", 1000], ["b", "38mm Woven", 300]])], new Set(["1"]), proposed, {}, defaults);

  it("splits CGST + SGST in-state", () => {
    const { lines: priced, totals } = priceLines(lines, "intra");
    expect(priced[0]).toMatchObject({ taxable: 12500, cgst: 312.5, sgst: 312.5, igst: 0, amount: 13125 });
    expect(priced[1]).toMatchObject({ taxable: 12000, cgst: 720, sgst: 720, amount: 13440 });
    expect(totals).toEqual({ taxable: 24500, cgst: 1032.5, sgst: 1032.5, igst: 0, tax: 2065, roundOff: 0, grand: 26565 });
  });

  it("IGST out of state, and the total rounds to the rupee", () => {
    const { totals } = priceLines(draftLines([dc("1", [["a", "x", 600]])], new Set(["1"]), [{ ...proposed[0], rate: 12.345 }], {}, defaults), "inter");
    expect(totals).toEqual({ taxable: 7407, cgst: 0, sgst: 0, igst: 370.35, tax: 370.35, roundOff: -0.35, grand: 7777 });
  });
});

describe("stateCodeFromGstin", () => {
  it("is the first two digits of a GSTIN and nothing for anything else", () => {
    expect(stateCodeFromGstin("33AAECB1234F1Z5")).toBe("33");
    expect(stateCodeFromGstin(" 29aaeps1111f1z2 ")).toBe("29");
    expect(stateCodeFromGstin("nope")).toBe("");
  });
});

// The server rounds a half-paisa up (utils/money.js toPaise); the screen
// must come to the same paisa, or a preview and the saved document
// differ by one. These are the server's own cases.
describe("round2", () => {
  it("takes a half-paisa up, which Math.round(n * 100) / 100 did not", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(8.345)).toBe(8.35);
    expect(round2(10.235)).toBe(10.24);
    expect(round2(1234567.895)).toBe(1234567.9);
    // GST of 5% on 100.10 is 5.005: five rupees and one paisa.
    expect(round2(100.10 * 0.05)).toBe(5.01);
  });

  it("rounds away from zero on both sides, and leaves what is honestly below the half", () => {
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(-0.005)).toBe(-0.01);
    expect(round2(1.0049)).toBe(1);
    expect(round2(1.004999)).toBe(1);
    expect(round2(123.454)).toBe(123.45);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1e9 + 0.004)).toBe(1e9);
  });

  it("counts what is not a number as nothing, so a column still adds up", () => {
    expect(round2(Number("abc"))).toBe(0);
    expect(round2(undefined as unknown as number)).toBe(0);
    expect([100, NaN, 50.555].reduce((t, v) => round2(t + round2(v)), 0)).toBe(150.56);
  });

  it("prices a line to the same paisa as the server", () => {
    // 77 m at ₹1.30 is 100.10; 5% on it is 5.005.
    const { lines, totals } = priceLines([{ elastic: "a", name: "x", unit: "m", quantity: 77, rate: 1.3, hsn: "5806", gstPercent: 5, dcNumbers: [], rateSource: "order" }], "inter");
    expect(lines[0].taxable).toBe(100.1);
    expect(lines[0].igst).toBe(5.01);
    expect(totals.tax).toBe(5.01);
  });
});
