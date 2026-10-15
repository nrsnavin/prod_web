// ══════════════════════════════════════════════════════════════════
//  CSV, AS A SPREADSHEET OPENS IT
//
//  Quoted where it has to be (comma, quote, newline), quotes doubled,
//  and a cell that starts like a formula (= + - @) prefixed with a quote
//  mark so opening the file never runs anything typed into a name.
//  A BOM up front so Excel reads ₹ and Tamil names as UTF-8.
// ══════════════════════════════════════════════════════════════════

export type CsvCell = string | number | boolean | null | undefined;

export function csvCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Hand the browser a CSV file to save. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
