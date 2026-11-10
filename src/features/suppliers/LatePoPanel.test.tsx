import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { LatePoPanel, type LatePo } from "./LatePoPanel";

// Late POs: what is still to come, the order each holds up, the chaser.

const get = vi.fn();
const post = vi.fn();
vi.mock("@/core/http/httpClient", () => ({ httpClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: vi.fn() } }));

const row = (over: Partial<LatePo> = {}): LatePo => ({
  _id: "p1", poNo: 501, expectedDate: "2026-11-04", daysLate: 4,
  supplier: { name: "Sri Murugan Yarns", phone: "+919840022222" },
  pending: [{ material: "40s black", unit: "kg", pending: 120, belowMinimum: true }],
  forOrder: { orderNo: 7001, supplyDate: "2026-11-11" }, promisedDate: null, chaseCount: 0, lastChasedAt: null,
  history: [], state: "overdue", chaseDue: true, why: "", atRisk: false, draft: "Hello Mr Raju,", waLink: "https://wa.me/919840022222?text=x", ...over,
});
const renderPanel = () => render(
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider><LatePoPanel /></ToastProvider>
    </QueryClientProvider>
  </MemoryRouter>
);

beforeEach(() => { get.mockReset(); post.mockReset(); });

describe("LatePoPanel", () => {
  it("shows nothing when nothing is late", async () => {
    get.mockResolvedValue({ rows: [], settings: { auto: false, hour: 10, gapDays: 2, acknowledge: false } });
    renderPanel();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/late deliveries/i)).not.toBeInTheDocument();
  });

  it("lists what is still to come and sends the chaser", async () => {
    get.mockResolvedValue({ rows: [row()], settings: { auto: false, hour: 10, gapDays: 2, acknowledge: false } });
    post.mockResolvedValue({ sent: true, dryRun: false });
    renderPanel();
    expect(await screen.findByText(/40s black 120 kg/)).toBeInTheDocument();
    expect(screen.getByText(/4 days late/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /send chaser/i }));
    expect(post).toHaveBeenCalledWith("/supplier/po/p1/chase", {}, { timeoutMs: 75_000 }); // the chaser is drafted by the model
  });

  it("names the customer order a promised date puts at risk, and does not chase it again", async () => {
    get.mockResolvedValue({ rows: [row({ state: "promised", promisedDate: "2026-11-14", atRisk: true, chaseDue: false })], settings: { auto: true, hour: 10, gapDays: 2, acknowledge: false } });
    renderPanel();
    expect(await screen.findByText(/Order #7001 due/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send chaser/i })).toBeDisabled();
  });
});
