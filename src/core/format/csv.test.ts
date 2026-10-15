import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes only what needs it and doubles quotes", () => {
    expect(csvCell("20mm Knitted")).toBe("20mm Knitted");
    expect(csvCell('25mm "Soft", navy')).toBe('"25mm ""Soft"", navy"');
    expect(csvCell(1240.5)).toBe("1240.5");
    expect(csvCell(null)).toBe("");
  });

  it("never lets a cell run as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(-5)).toBe("-5"); // a real negative number stays a number
  });

  it("joins rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("a,b\r\n1,x");
  });
});
