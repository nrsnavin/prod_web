import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QcPanel } from "./QcPanel";
import type { JobDetail } from "./types";

// ══════════════════════════════════════════════════════════════════
//  THE CERTIFICATE, WHEN A LATER CHECK FAILED
//
//  A certificate of analysis shows each elastic's latest PASSING check.
//  When a later check of the same elastic failed, the sheet still read
//  PASS — ready to print and sign — and nothing on the screen said the
//  last word on that elastic was a failure.
//
//  The server now says so beside the item (`laterFail`). The page shows
//  it above the sheet, on screen only: the certificate that prints is
//  the certificate; the caution is for whoever is about to print it.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
vi.mock("@/core/http/httpClient", async () => {
  const actual = await vi.importActual<typeof import("@/core/http/httpClient")>("@/core/http/httpClient");
  return { ...actual, httpClient: { get: (...a: unknown[]) => get(...a), post: vi.fn() } };
});
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const job = { id: "j1", jobNo: "J-812", plannedElastics: [{ elasticId: "e1", elasticName: "20mm Black", quantity: 1000 }] } as unknown as JobDetail;
const passing = { parameter: "Width (mm)", expected: "20", measured: "20", pass: true };
const record = { _id: "r1", elastic: { _id: "e1", name: "20mm Black" }, results: [passing], overallResult: "pass" as const, createdAt: "2026-11-10T06:00:00.000Z" };

type Item = { elasticName: string; checkedBy: string; checkedAt: string; results: (typeof passing)[]; laterFail?: unknown };
const coaWith = (items: Item[]) => ({ success: true, coa: { jobOrderNo: 812, orderNo: 101, customerPo: "PO-7", customerName: "Acme", items } });
const item = (over: Partial<Item> = {}): Item => ({
  elasticName: "20mm Black", checkedBy: "Meena", checkedAt: "2026-11-10T06:00:00.000Z", results: [passing], ...over,
});

let coa = coaWith([item()]);
beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url: string) => Promise.resolve(url === "/qc/coa" ? coa : { success: true, records: [record] }));
});

const openCertificate = async () => {
  const u = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><QcPanel job={job} /></QueryClientProvider>);
  await u.click(await screen.findByRole("button", { name: /COA/ }));
  await screen.findByText("CERTIFICATE OF ANALYSIS");
};

describe("the certificate of analysis", () => {
  it("says, on screen, when a later check of the elastic failed", async () => {
    coa = coaWith([item({ laterFail: { at: "2026-11-12T06:00:00.000Z", defectCode: "WIDTH-OOS", rejectedMeters: 40 } })]);
    await openCertificate();

    const caution = await screen.findByRole("alert");
    // Before: nothing — the sheet read PASS.
    expect(caution).toHaveTextContent("20mm Black");
    expect(caution).toHaveTextContent(/failed its latest check on 12 Nov 2026/);
    expect(caution).toHaveTextContent("WIDTH-OOS");
    expect(caution).toHaveTextContent("40 m rejected");
    expect(caution).toHaveTextContent(/earlier pass of 10 Nov 2026/);
    // For the person about to print, not for the customer's copy.
    expect(caution.className).toMatch(/print:hidden/);
  });

  it("says it without a defect or metres when none were recorded", async () => {
    coa = coaWith([item({ laterFail: { at: "2026-11-12T06:00:00.000Z", defectCode: "", rejectedMeters: 0 } })]);
    await openCertificate();
    const caution = await screen.findByRole("alert");
    expect(caution).toHaveTextContent(/failed its latest check on 12 Nov 2026\./);
    expect(caution).not.toHaveTextContent(/rejected/);
  });

  it("says nothing when the latest check of every elastic passed", async () => {
    coa = coaWith([item({ laterFail: null }), item({ elasticName: "20mm White" })]);   // and an older server sends none
    await openCertificate();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
