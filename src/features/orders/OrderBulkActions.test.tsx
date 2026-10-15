import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderBulkActions, ordersCsv, MAX_ORDER_PRINT } from "./OrderBulkActions";
import { OrderListItem } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE ORDER LIST'S MULTI-SELECT: PRINT AND EXPORT
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const statusReportsPdf = vi.fn();
const saveBlob = vi.fn();

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./api", () => ({ orderService: { statusReportsPdf: (ids: string[]) => statusReportsPdf(ids) } }));
vi.mock("@/features/elastics/ElasticBulkActions", () => ({ saveBlob: (...a: unknown[]) => saveBlob(...a) }));

const o = (id: string, orderNo: number) =>
  ({ _id: id, orderNo, status: "Open", po: "PO-1", date: "2026-10-01T00:00:00Z", customer: { name: "Acme" } }) as OrderListItem;

beforeEach(() => [toast, statusReportsPdf, saveBlob].forEach((f) => f.mockReset()));

it("prints their status reports as one PDF", async () => {
  statusReportsPdf.mockResolvedValue(new Blob(["%PDF"]));
  const u = userEvent.setup();
  render(<OrderBulkActions selected={[o("a", 1), o("b", 2)]} onClear={() => {}} />);
  await u.click(screen.getByRole("button", { name: /Print status reports/ }));
  expect(statusReportsPdf).toHaveBeenCalledWith(["a", "b"]);
  await waitFor(() => expect(saveBlob).toHaveBeenCalled());
});

it("says so when the PDF cannot be made", async () => {
  statusReportsPdf.mockRejectedValue(new Error("boom"));
  const u = userEvent.setup();
  render(<OrderBulkActions selected={[o("a", 1)]} onClear={() => {}} />);
  await u.click(screen.getByRole("button", { name: /Print status reports/ }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith("Could not make the PDF", "error"));
});

it("prints at most the server's limit at a time", () => {
  const many = Array.from({ length: MAX_ORDER_PRINT + 1 }, (_, i) => o(`id${i}`, i));
  render(<OrderBulkActions selected={many} onClear={() => {}} />);
  expect(screen.getByRole("button", { name: /Print status reports/ })).toBeDisabled();
});

it("exports a row per order", () => {
  expect(ordersCsv([o("a", 7)]).split("\r\n")[1]).toMatch(/^7,Acme,PO-1,2026-10-01,,/);
});
