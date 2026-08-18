import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiHealthPage } from "./AiHealthPage";
import type { AiHealth } from "./api";

// ══════════════════════════════════════════════════════════════════
//  THE PAGE THAT ANSWERS "IS OUR AI WORKING?"
//
//  A dashboard about accuracy is itself a claim about accuracy, so the
//  things worth testing here are not the layout — they are the places
//  where a plausible-looking number would be a lie:
//
//    • a surface nobody has reviewed must not show 0%
//    • an alias model must be visibly distinguished from a pinned one
//    • a missing API key must be stated before the zeros it explains
//    • a broken ledger must not be dressed up as "all clear"
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return { ...actual, aiHealthService: { get: (d: number, f?: boolean) => get(d, f) } };
});

const health = (over: Partial<AiHealth> = {}): AiHealth => ({
  status: "ok",
  configured: true,
  windowDays: 30,
  models: {
    text:   { id: "claude-haiku-4-5-20251001", pinned: true },
    vision: { id: "claude-sonnet-5", pinned: false },
  },
  prompts: { "qc-vision": "v1.0", "shift-sheet-ocr": "v1.0" },
  surfaces: [],
  weakestFields: [],
  ...over,
});

const surface = (over = {}) => ({
  surface: "shift-sheet-ocr",
  total: 10, decided: 8, pending: 2,
  accepted: 6, edited: 2, rejected: 0, failed: 0,
  acceptRate: 75, usefulRate: 100,
  avgLatencyMs: 4200,
  tokens: { input: 90_000, output: 12_000 },
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AiHealthPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => get.mockReset());

describe("AiHealthPage", () => {
  it("reports agreement per feature, in the plant's words rather than the code's", async () => {
    get.mockResolvedValue(health({ surfaces: [surface()] }));
    renderPage();

    // The surface key is an implementation detail; the person reading
    // this page knows the feature by what it does. (The label appears
    // in the prompt-versions card too, so the assertion is scoped to
    // the table rather than to the page.)
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Shift sheet OCR")).toBeInTheDocument();
    expect(screen.queryByText("shift-sheet-ocr")).not.toBeInTheDocument();
    expect(within(table).getByText("75% of 8")).toBeInTheDocument();
  });

  it("says 'not reviewed yet' rather than 0% when nothing has been decided", async () => {
    // The single most misleading thing this page could do. A surface
    // with twelve suggestions and no reviews has not failed twelve
    // times — nobody has looked yet, and those are different facts.
    get.mockResolvedValue(health({
      surfaces: [surface({
        total: 12, decided: 0, pending: 12, accepted: 0, edited: 0,
        acceptRate: null, usefulRate: null,
      })],
    }));
    renderPage();

    expect(await screen.findAllByText(/not reviewed yet/i)).not.toHaveLength(0);
    expect(screen.queryByText("0% of 0")).not.toBeInTheDocument();
    expect(screen.getByText(/no agreement to report/i)).toBeInTheDocument();
  });

  it("distinguishes a pinned model from one that can move underneath us", async () => {
    get.mockResolvedValue(health());
    renderPage();

    expect(await screen.findByText("claude-haiku-4-5-20251001")).toBeInTheDocument();
    expect(screen.getByText("pinned")).toBeInTheDocument();
    // The alias is the one that matters: it can be re-pointed upstream
    // with no deploy here, which is the one change nothing else can be
    // correlated against.
    expect(screen.getByText("alias")).toBeInTheDocument();
    expect(screen.getByText(/current upstream/i)).toBeInTheDocument();
  });

  it("says the key is missing before showing the zeros that follow from it", async () => {
    get.mockResolvedValue(health({ configured: false, surfaces: [] }));
    renderPage();

    expect(await screen.findByText(/no api key on this server/i)).toBeInTheDocument();
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
  });

  it("does not dress a broken ledger up as an all-clear", async () => {
    get.mockResolvedValue(health({
      status: "degraded",
      ledgerError: "connection timed out",
      surfaces: undefined,
    }));
    renderPage();

    expect(await screen.findByText(/usage figures unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/connection timed out/)).toBeInTheDocument();
    // What does not depend on the ledger is still shown.
    expect(screen.getByText("claude-haiku-4-5-20251001")).toBeInTheDocument();
  });

  it("names the columns people keep correcting", async () => {
    get.mockResolvedValue(health({
      surfaces: [surface()],
      weakestFields: [{ surface: "shift-sheet-ocr", field: "rows[].timer", suggestions: 7 }],
    }));
    renderPage();

    const item = (await screen.findByText("rows[].timer")).closest("li")!;
    expect(within(item).getByText(/7 suggestions/)).toBeInTheDocument();
  });

  it("asks the server for a different window when one is chosen", async () => {
    get.mockResolvedValue(health({ surfaces: [surface()] }));
    renderPage();
    await screen.findByRole("table");
    expect(get).toHaveBeenCalledWith(30, undefined);

    await userEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(get).toHaveBeenCalledWith(7, undefined);
  });

  it("shows prompt versions, so a drop can be checked against a change", async () => {
    get.mockResolvedValue(health());
    renderPage();
    expect(await screen.findByText("QC vision")).toBeInTheDocument();
    expect(screen.getAllByText("v1.0")).toHaveLength(2);
  });

  it("explains an empty window instead of showing a bare blank", async () => {
    get.mockResolvedValue(health({ surfaces: [] }));
    renderPage();
    expect(await screen.findByText(/no ai activity in this window/i)).toBeInTheDocument();
  });
});
