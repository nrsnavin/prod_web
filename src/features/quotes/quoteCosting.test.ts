import { describe, it, expect } from "vitest";
import {
  MaterialRow,
  newKey,
  num,
  priceOneMetre,
  roundTo,
  rowCost,
  startingRows,
} from "./costing";

// ══════════════════════════════════════════════════════════════════
//  THE BROWSER'S COPY OF THE COSTING
//
//  This mirrors utils/quoteCosting.js on the server so the sheet can
//  price as you type. Two copies of one calculation is a real risk, so
//  these tests use the SAME worked example the server's tests use:
//
//    4.2 g warp yarn        @ 240/kg
//    1.1 g spandex covering @ 620/kg
//    0.8 g warp spandex     @ 900/kg
//    2.4 g weft yarn        @ 180/kg
//    + 1.25 conversion, 20% margin, 5% GST
//    = 2.842 material, 4.092 cost, 4.91 rate, 5.16 inc GST
//
//  If the two ever drift, one of these two files fails, and both name
//  the same numbers.
// ══════════════════════════════════════════════════════════════════

const row = (label: string, weightGrams: string, ratePerKg: string): MaterialRow => ({
  key: newKey(),
  label,
  weightGrams,
  ratePerKg,
});

const recipe = () => ({
  materials: [
    row("Warp yarn", "4.2", "240"),
    row("Spandex covering", "1.1", "620"),
    row("Warp spandex", "0.8", "900"),
    row("Weft yarn", "2.4", "180"),
  ],
  conversionCost: "1.25",
  marginPercent: "20",
  gstPercent: "5",
  quantityMetres: "5000",
});

describe("the same worked example the server uses", () => {
  const q = priceOneMetre(recipe());

  it("sums the materials", () => expect(q.materialCost).toBe(2.842));
  it("adds conversion", () => expect(q.totalCost).toBe(4.092));
  it("marks up on cost, quoted in paise", () => expect(q.rateBeforeTax).toBe(4.91));
  it("takes GST on the quoted rate", () => expect(q.gstAmount).toBe(0.25));
  it("reaches the inclusive rate", () => expect(q.rateInclTax).toBe(5.16));
  it("totals the grams in a metre", () => expect(q.totalWeightGrams).toBe(8.5));

  it("reconciles exactly — rate × quantity IS the value", () => {
    expect(q.valueBeforeTax).toBe(24550);   // 4.91 × 5000
    expect(q.valueInclTax).toBe(25800);     // 5.16 × 5000
    expect(q.rateInclTax).toBe(q.rateBeforeTax + q.gstAmount);
  });
});

describe("grams against a rate per kilogram", () => {
  it("divides by a thousand", () => {
    expect(rowCost(4.2, 240)).toBe(1.008);
  });

  it("is not the naive product", () => {
    // The inverted version returns 1008. This is the guard against a
    // unit conversion silently going upside down.
    expect(rowCost(4.2, 240)).toBeLessThan(2);
  });
});

describe("margin is a markup on cost", () => {
  const flat = (marginPercent: string) =>
    priceOneMetre({
      materials: [row("X", "1000", "100")], // exactly ₹100
      conversionCost: "0",
      marginPercent,
      gstPercent: "0",
      quantityMetres: "0",
    });

  it("20% on ₹100 is ₹120", () => {
    expect(flat("20").totalCost).toBe(100);
    expect(flat("20").rateBeforeTax).toBe(120);
  });

  it("is not ₹125", () => {
    expect(flat("20").rateBeforeTax).not.toBe(125);
  });
});

describe("what the text inputs can contain", () => {
  it("reads an empty field as nothing", () => {
    expect(num("")).toBe(0);
    expect(num(undefined)).toBe(0);
  });

  it("reads a half-typed decimal as nothing rather than NaN", () => {
    // Somebody typing "0." mid-keystroke must not blank the whole sheet.
    expect(num(".")).toBe(0);
    expect(num("-")).toBe(0);
  });

  it("refuses a negative, so a minus sign cannot discount the quote", () => {
    expect(num("-5")).toBe(0);
    expect(rowCost(num("-4.2"), num("240"))).toBe(0);
  });

  it("ignores text", () => {
    expect(num("abc")).toBe(0);
  });

  it("prices a sheet where nothing has been typed yet", () => {
    const q = priceOneMetre({
      materials: startingRows(),
      conversionCost: "",
      marginPercent: "",
      gstPercent: "",
      quantityMetres: "",
    });
    expect(q.totalCost).toBe(0);
    expect(q.rateInclTax).toBe(0);
    // The four rows are still there — a sheet that empties itself as you
    // clear a field would be unusable.
    expect(q.rows).toHaveLength(4);
  });
});

describe("the four rows the sheet starts with", () => {
  it("names them in recipe order", () => {
    expect(startingRows().map((r) => r.label)).toEqual([
      "Warp yarn",
      "Spandex covering",
      "Warp spandex",
      "Weft yarn",
    ]);
  });

  it("marks them fixed, so their names are not editable", () => {
    expect(startingRows().every((r) => r.fixed)).toBe(true);
  });

  it("gives every row a distinct key", () => {
    const keys = startingRows().map((r) => r.key);
    expect(new Set(keys).size).toBe(4);
  });

  it("prices rows added beyond them the same way", () => {
    const q = priceOneMetre({
      ...recipe(),
      materials: [...recipe().materials, row("Dye", "0.5", "400")],
    });
    expect(q.rows).toHaveLength(5);
    expect(q.materialCost).toBe(3.042); // 2.842 + 0.2
  });
});

describe("rounding", () => {
  it("settles the binary tail before rounding to paise", () => {
    // 1.005 × 3 is 3.0149999999999997 in floating point.
    expect(roundTo(1.005 * 3, 2)).toBe(3.02);
  });

  it("does not accumulate a floating-point tail across rows", () => {
    const q = priceOneMetre({
      materials: [row("A", "0.1", "100"), row("B", "0.2", "100")],
      conversionCost: "0", marginPercent: "0", gstPercent: "0", quantityMetres: "0",
    });
    expect(q.materialCost).toBe(0.03);
  });

  it("keeps four places through the costing, so a small material is not flattened", () => {
    const q = priceOneMetre({
      materials: [row("X", "1.26", "360")],
      conversionCost: "0", marginPercent: "0", gstPercent: "0", quantityMetres: "0",
    });
    expect(q.materialCost).toBe(0.4536);
  });
});
