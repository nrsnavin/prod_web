import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { SandboxBadge, SessionDatabase } from "./SandboxBadge";
import { httpClient } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  THE BADGE THAT ANSWERS "WHICH DATABASE AM I IN"
//
//  Some accounts are routed to a sandbox database. A sandbox request
//  is designed to look exactly like a live one, which is right for the
//  code and wrong for the person in front of it — and the cost of that
//  silence was an afternoon spent on a machine and a service log that
//  were plainly on screen while the API insisted they did not exist.
//
//  Two properties matter, and the second is why this can ship to a
//  live app without a second thought:
//
//    • when the session IS routed, it says so, and names the database
//    • when it is not, it renders NOTHING — no chip for the hundreds
//      of ordinary users to learn to ignore, and no change at all to
//      the production screen most people load.
// ══════════════════════════════════════════════════════════════════

vi.mock("@/core/http/httpClient", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  httpClient: { get: vi.fn() },
}));

const session = (over: Partial<SessionDatabase> = {}): SessionDatabase => ({
  email: "someone@example.com",
  database: "baluElastics",
  sandbox: false,
  configured: true,
  ...over,
});

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const show = (data: SessionDatabase) => {
  vi.mocked(httpClient.get).mockResolvedValue(data as never);
  return render(<SandboxBadge />, { wrapper });
};

describe("the sandbox badge", () => {
  it("names the sandbox database when the session is routed to one", async () => {
    show(session({ database: "test", sandbox: true }));
    expect(await screen.findByText(/sandbox · test/i)).toBeInTheDocument();
  });

  it("renders nothing for an ordinary session on the live database", async () => {
    // The whole reason this is safe to put in a live topbar.
    const { container } = show(session({ sandbox: false }));
    await waitFor(() => expect(httpClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when sandbox routing is not configured at all", async () => {
    const { container } = show(session({ sandbox: false, configured: false }));
    await waitFor(() => expect(httpClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing touches live data, in words somebody can act on", async () => {
    show(session({ database: "test", sandbox: true }));
    const badge = await screen.findByTitle(/nothing here touches live data/i);
    // The database NAME, not just the word "sandbox": two sandboxes are
    // possible and "which one" is the next question.
    expect(badge).toHaveAttribute("title", expect.stringContaining('"test"'));
  });

  it("stays quiet when the endpoint is unreachable", async () => {
    // An older API without the route, or a network blip. A diagnostic
    // that breaks the page it sits on is worse than no diagnostic.
    vi.mocked(httpClient.get).mockRejectedValue(new Error("404"));
    const { container } = render(<SandboxBadge />, { wrapper });
    await waitFor(() => expect(httpClient.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("asks the API exactly once, not on every render", async () => {
    // It cannot change without a new login.
    show(session({ database: "test", sandbox: true }));
    await screen.findByText(/sandbox · test/i);
    render(<SandboxBadge />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/sandbox · test/i).length).toBe(2));
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
});
