import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ══════════════════════════════════════════════════════════════════
//  THE BONUS RECORDS TABLE SHOWS WHAT THE RECORDS SAY
//
//  Two columns of it read fields the server has never sent (`daysWorked`,
//  `percent`), so "Days worked" and "Percent" were "—" for everybody the
//  moment the bonus was generated. A record keeps `attendanceDays` and
//  `bonusPercent`.
//
//  And a record of ₹0 — somebody under the minimum days — is not a
//  payment waiting: it showed "pending" with a "Mark ₹0 paid" button.
//  The server now refuses to pay one (prod:
//  tests/api/bonusSettingsAndNothingDue.test.js); the page does not offer it.
//
//  Only the HTTP transport is mocked: the real api and page run.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();

vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return {
    ...actual,
    httpClient: {
      get: (...a: unknown[]) => get(...a),
      put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), getBlob: vi.fn(),
    },
  };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { BonusPage } from "./BonusPage";

const YEAR = new Date().getFullYear();
const RECORDS = [
  { _id: "r1", year: YEAR, employee: { _id: "e1", name: "Ravi", department: "weaving" }, attendanceDays: 262, totalWorkingDays: 300, bonusPercent: 10, bonusAmount: 18400, status: "pending" },
  { _id: "r2", year: YEAR, employee: { _id: "e2", name: "Newcomer", department: "packing" }, attendanceDays: 12, totalWorkingDays: 300, bonusPercent: 10, bonusAmount: 0, status: "pending" },
  { _id: "r3", year: YEAR, employee: { _id: "e3", name: "Selvi", department: "weaving" }, attendanceDays: 290, totalWorkingDays: 300, bonusPercent: 12, bonusAmount: 26000, status: "paid" },
];

function serve(status = "triggered") {
  get.mockImplementation(async (url: string) => {
    if (url === "/bonus/config") {
      return { config: { year: YEAR, status, bonusDate: `${YEAR}-10-20T00:00:00.000Z`, yearlyWorkingDays: 300 },
               stats: { totalRecords: 3, paidRecords: 1, pendingRecords: 1, nothingDueRecords: 1, totalPayout: 44400 } };
    }
    if (url === "/bonus/records") return { success: true, records: RECORDS };
    if (url === "/bonus/preview") {
      return { success: true, year: YEAR, approximate: true, canGenerate: false, configured: true,
               diwaliDate: `${YEAR}-10-20T00:00:00.000Z`, bonusLabel: "", totalPayout: 0, rows: [], window: { start: "", end: "" } };
    }
    throw new Error(`unexpected GET ${url}`);
  });
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><BonusPage /></QueryClientProvider>);
}
const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;

beforeEach(() => { get.mockReset(); serve(); });

describe("a generated bonus record", () => {
  it("shows the days worked and the percent it was worked out at", async () => {
    show();
    const row = await rowOf("Ravi");
    // Before: "—" in both.
    expect(within(row).getByText("262")).toBeInTheDocument();
    expect(within(row).getByText("/ 300")).toBeInTheDocument();
    expect(within(row).getByText("10%")).toBeInTheDocument();
    expect(within(await rowOf("Selvi")).getByText("12%")).toBeInTheDocument();
  });

  it("of ₹0 says nothing is due, and is not offered for payment", async () => {
    show();
    const none = await rowOf("Newcomer");
    expect(within(none).getByText("nothing due")).toBeInTheDocument();
    expect(within(none).queryByText("pending")).not.toBeInTheDocument();
    // Before: "Mark paid…", for ₹0.
    expect(within(none).queryByRole("button", { name: /mark paid/i })).not.toBeInTheDocument();

    const owed = await rowOf("Ravi");
    expect(within(owed).getByText("pending")).toBeInTheDocument();
    expect(within(owed).getByRole("button", { name: /mark paid/i })).toBeInTheDocument();
    expect(within(await rowOf("Selvi")).queryByRole("button", { name: /mark paid/i })).not.toBeInTheDocument();
  });

  it("is counted as nothing due beside the payments waiting", async () => {
    show();
    expect(await screen.findByText("1 more with nothing due")).toBeInTheDocument();
  });
});

describe("a year that is paid out", () => {
  it("does not offer to generate it again", async () => {
    serve("completed");
    show();
    await rowOf("Ravi");
    // Before: a disabled "Available in October" button on a finished year.
    expect(screen.queryByRole("button", { name: /available in|generate .* bonus/i })).not.toBeInTheDocument();
  });
});
