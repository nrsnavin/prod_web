import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { PoIntakeModal } from "./PoIntakeModal";
import type { PoIntakeResult, PoIntakeLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A FILLED-IN FORM INVITES A CONFIRM
//
//  This is the one OCR surface in the system reading a document nobody
//  here designed — a customer's letterhead, photographed. The more
//  complete the result looks, the less it gets read, which is exactly
//  backwards.
//
//  So the tests are about what the screen makes LOUD:
//
//    • an unmatched line must not look like a matched one
//    • a preselected match must still show what else it could be
//    • a product withheld for a width conflict must be named — nobody
//      who cannot see why "25mm" is missing will conclude anything
//      except that the master lacks it
//    • and it must say, in words, that nothing was created
// ══════════════════════════════════════════════════════════════════

const intakePo = vi.fn();
vi.mock("./api", () => ({ orderService: { intakePo: (f: File) => intakePo(f) } }));

const line = (over: Partial<PoIntakeLine> = {}): PoIntakeLine => ({
  description: "20MM KNITTED ELASTIC WHT",
  quantity: 5000, unit: "m", rate: 12.5, confidence: 0.9,
  match: {
    elasticId: "e20", elasticName: "20mm Knitted Elastic - White",
    candidates: [{ id: "e20", name: "20mm Knitted Elastic - White", score: 0.94 }],
    confident: true,
    blockedByWidth: [],
  },
  ...over,
});

const result = (over: Partial<PoIntakeResult> = {}): PoIntakeResult => ({
  success: true, ok: true, available: true,
  aiSuggestionId: "s1", model: "vision-x",
  draft: {
    customerName: "Sri Lakshmi Garments",
    poNumber: "PO-8891", poDate: "2026-08-01", deliveryDate: "2026-09-15",
    currency: "INR", notes: "", confidence: 0.9,
    lines: [line()],
    customer: {
      customerId: "c1", customerName: "Sri Lakshmi Garments",
      candidates: [{ id: "c1", name: "Sri Lakshmi Garments", score: 1 }],
      confident: true,
    },
  },
  summary: { lines: 1, matched: 1, needsAttention: 0, customerMatched: true },
  disclaimer: "A draft read from a document. Nothing has been created. Check every line — particularly the widths and the rates — before saving the order.",
  ...over,
});

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <PoIntakeModal onClose={() => {}} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

/**
 * The file input is hidden behind a styled button, which is the normal
 * pattern here, so it is reached by type rather than by label.
 */
const upload = async () => {
  const file = new File(["x"], "po.png", { type: "image/png" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, file);
};

beforeEach(() => intakePo.mockReset());

describe("PoIntakeModal", () => {
  it("says nothing is created, before anything is read", () => {
    renderModal();
    expect(screen.getByText(/nothing is created from this/i)).toBeInTheDocument();
  });

  it("shows what the document said verbatim, beside what it matched", async () => {
    // The description is the thing to check against, so the match never
    // replaces it on screen.
    intakePo.mockResolvedValue(result());
    renderModal();
    await upload();

    expect(await screen.findByText("20MM KNITTED ELASTIC WHT")).toBeInTheDocument();
    expect(screen.getByText("20mm Knitted Elastic - White")).toBeInTheDocument();
    expect(screen.getByText(/5,000 m/)).toBeInTheDocument();
  });

  it("makes an unmatched line loud rather than blank", async () => {
    intakePo.mockResolvedValue(result({
      draft: {
        ...result().draft!,
        lines: [line({
          match: {
            elasticId: null, elasticName: null, confident: false,
            candidates: [
              { id: "a", name: "20mm Knitted Elastic - White", score: 0.81 },
              { id: "b", name: "20mm Knitted Elastic - Black", score: 0.79 },
            ],
            blockedByWidth: [],
          },
        })],
      },
      summary: { lines: 1, matched: 0, needsAttention: 1, customerMatched: true },
    }));
    renderModal();
    await upload();

    expect(await screen.findByText(/needs a pick/i)).toBeInTheDocument();
    expect(screen.getByText(/could not be matched confidently/i)).toBeInTheDocument();
  });

  it("names a product withheld for a width conflict", async () => {
    // Without this somebody concludes the master is missing the product
    // and creates a duplicate.
    intakePo.mockResolvedValue(result({
      draft: {
        ...result().draft!,
        lines: [line({
          match: {
            ...line().match,
            blockedByWidth: [{
              name: "25mm Knitted Elastic - White",
              reason: "The document says 20 and this says 25.",
            }],
          },
        })],
      },
    }));
    renderModal();
    await upload();

    await userEvent.click(await screen.findByRole("button", { name: /other possibilities/i }));
    expect(screen.getByText("25mm Knitted Elastic - White")).toBeInTheDocument();
    expect(screen.getByText(/says 20 and this says 25/)).toBeInTheDocument();
  });

  it("shows the alternatives even when a match was preselected", async () => {
    // A preselected match is still a suggestion. The wrong pick has to
    // be one click to fix.
    intakePo.mockResolvedValue(result());
    renderModal();
    await upload();

    const toggle = await screen.findByRole("button", { name: /other possibilities/i });
    await userEvent.click(toggle);
    expect(screen.getAllByText("20mm Knitted Elastic - White").length).toBeGreaterThan(1);
  });

  it("flags a quantity or rate it could not read, rather than showing a zero", async () => {
    // A plausible number in a price column is far worse than an empty
    // one: the empty gets filled in, the wrong one gets confirmed.
    intakePo.mockResolvedValue(result({
      draft: {
        ...result().draft!,
        lines: [line({ quantity: null, rate: null })],
      },
    }));
    renderModal();
    await upload();

    expect(await screen.findByText(/no quantity read/i)).toBeInTheDocument();
    expect(screen.getByText(/no rate read/i)).toBeInTheDocument();
  });

  it("asks for a customer when it could not match one", async () => {
    intakePo.mockResolvedValue(result({
      draft: {
        ...result().draft!,
        customerName: "Some New Buyer Ltd",
        customer: { customerId: null, customerName: null, candidates: [], confident: false },
      },
      summary: { lines: 1, matched: 1, needsAttention: 0, customerMatched: false },
    }));
    renderModal();
    await upload();

    expect(await screen.findByText(/no match, pick one/i)).toBeInTheDocument();
  });

  it("repeats the disclaimer under the result", async () => {
    intakePo.mockResolvedValue(result());
    renderModal();
    await upload();
    expect(await screen.findByText(/nothing has been created/i)).toBeInTheDocument();
  });

  it("does not render a result when the document could not be read", async () => {
    intakePo.mockResolvedValue({
      success: true, available: true, ok: false,
      message: "Couldn't read that document confidently — enter the order manually.",
      summary: { lines: 0, matched: 0, needsAttention: 0, customerMatched: false },
      disclaimer: "",
    });
    renderModal();
    await upload();

    expect(screen.queryByText(/Line 1/)).not.toBeInTheDocument();
  });
});
