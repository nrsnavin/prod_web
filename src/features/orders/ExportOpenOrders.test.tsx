import { it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportOpenOrders } from "./ExportOpenOrders";

// ══════════════════════════════════════════════════════════════════
//  THE ORDER LIST'S "EXPORT OPEN ORDERS": every order still in hand,
//  as an Excel file named for the day.
// ══════════════════════════════════════════════════════════════════

const toast = vi.fn();
const exportOpen = vi.fn();
const saveBlob = vi.fn();

vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("./api", () => ({ orderService: { exportOpen: () => exportOpen() } }));
vi.mock("@/features/elastics/ElasticBulkActions", () => ({ saveBlob: (...a: unknown[]) => saveBlob(...a) }));
vi.mock("@/core/format/date", () => ({ todayYmd: () => "2026-11-23" }));

beforeEach(() => [toast, exportOpen, saveBlob].forEach((f) => f.mockReset()));

it("downloads the open orders as an Excel file named for today", async () => {
  const file = new Blob(["PK"]);
  exportOpen.mockResolvedValue(file);
  render(<ExportOpenOrders />);
  await userEvent.click(screen.getByRole("button", { name: /Export open orders/ }));
  await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(file, "open-orders-2026-11-23.xlsx"));
  expect(toast).not.toHaveBeenCalled();
});

it("says so when the file cannot be made", async () => {
  exportOpen.mockRejectedValue(new Error("offline"));
  render(<ExportOpenOrders />);
  await userEvent.click(screen.getByRole("button", { name: /Export open orders/ }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith("Could not export the open orders", "error"));
  expect(saveBlob).not.toHaveBeenCalled();
});
