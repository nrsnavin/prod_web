import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ComplaintsPage } from "./ComplaintsPage";
import type { ComplaintRow } from "./types";

// ══════════════════════════════════════════════════════════════════
//  READING A COMPLAINT
//
//  Found reading the complaints screens line by line.
//
//  1. THE COMPLAINT ITSELF COULD NOT BE READ. The list shows one
//     truncated line of what the customer said, and selecting a row
//     opened the trace, the resolution box and the reply — and nowhere
//     the complaint. Anything past the first line was not on the page.
//
//  2. NEITHER COULD ITS NOTES. "As the customer sent it", every reply
//     marked as sent ("Kept on the complaint's notes", the toast says),
//     and now who settled it, are all kept in the notes — which no
//     screen here showed.
//
//  3. THE JOB NUMBER NEVER APPEARED. The list read `job.jobNo`; the
//     server sends `job.jobOrderNo`.
// ══════════════════════════════════════════════════════════════════

const list = vi.fn();
vi.mock("./api", () => ({ complaintService: { list: (p: unknown) => list(p), update: vi.fn() } }));
vi.mock("./BlastRadiusPanel", () => ({ BlastRadiusPanel: () => <div data-testid="trace" /> }));
vi.mock("./ThemesPanel", () => ({ ThemesPanel: () => null }));
vi.mock("./ReplyPanel", () => ({ ReplyPanel: () => null }));
vi.mock("./FileComplaintModal", () => ({ FileComplaintModal: () => null }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const LONG =
  "Shade band across rolls 14 to 19 of the 20mm black. Our cutting room found it under daylight, " +
  "not under the tube lights, and two bundles had already been stitched into waistbands before anyone noticed.";

const row = (over: Partial<ComplaintRow> = {}): ComplaintRow => ({
  _id: "c1", date: "2026-11-19T06:30:00.000Z", category: "shade", status: "Open", reason: LONG,
  customer: { _id: "cu1", name: "Acme Garments" },
  elastic: { _id: "e1", name: "20mm Black" },
  job: { _id: "j1", jobOrderNo: 812, order: { orderNo: 101 } },
  ...over,
});

const show = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ComplaintsPage /></QueryClientProvider>);
const respond = (rows: ComplaintRow[]) =>
  list.mockResolvedValue({ success: true, count: rows.length, total: rows.length, page: 1, limit: 100, data: rows });

beforeEach(() => { list.mockReset(); });

describe("the list", () => {
  it("names the job, and writes the date the one way dates are written here", async () => {
    respond([row()]);
    show();
    // Before: "19/11/2026 · shade" — no job, since `jobNo` is not what the server sends.
    expect(await screen.findByText("19 Nov 2026 · Job 812 · shade")).toBeInTheDocument();
  });

  it("says nothing of a job when the complaint's job is gone", async () => {
    respond([row({ job: null })]);
    show();
    expect(await screen.findByText("19 Nov 2026 · shade")).toBeInTheDocument();
  });
});

describe("a complaint, opened", () => {
  const open = async () => {
    const u = userEvent.setup();
    show();
    await u.click(await screen.findByRole("button", { name: /Acme Garments/ }));
    return screen.getByRole("region", { name: "The complaint" });
  };

  it("can be read in full, with what it is about", async () => {
    respond([row()]);
    const card = await open();
    // Before: only the list's one truncated line.
    expect(within(card).getByText(LONG)).toBeInTheDocument();
    expect(within(card).getByText("Acme Garments")).toBeInTheDocument();
    expect(within(card).getByText(/Job 812/)).toBeInTheDocument();
    expect(within(card).getByText(/Order 101/)).toBeInTheDocument();
    expect(within(card).getByText(/20mm Black/)).toBeInTheDocument();
  });

  it("shows its notes: what was sent, each reply, who settled it", async () => {
    const notes =
      "As the customer sent it:\nshade problem in last lot pls check\n\n" +
      "Reply sent 20 Nov 2026 by Asha:\nWe are sorry about the shade band. A replacement leaves on Monday.\n\n" +
      "Marked Resolved (was Open) on 21 Nov 2026 by Asha";
    respond([row({ feedback: notes, status: "Resolved" })]);
    const card = await open();
    const block = within(card).getByLabelText("Notes");
    // Before: kept, and shown nowhere.
    expect(block).toHaveTextContent("Reply sent 20 Nov 2026 by Asha:");
    expect(block).toHaveTextContent("A replacement leaves on Monday.");
    expect(block).toHaveTextContent("Marked Resolved (was Open) on 21 Nov 2026 by Asha");
    expect(block.className).toMatch(/whitespace-pre-wrap/);
  });

  it("has no notes block when there are none", async () => {
    respond([row({ feedback: "" })]);
    const card = await open();
    expect(within(card).queryByLabelText("Notes")).not.toBeInTheDocument();
  });

  it("still opens the trace above the rest", async () => {
    respond([row()]);
    await open();
    expect(screen.getByTestId("trace")).toBeInTheDocument();
  });
});
