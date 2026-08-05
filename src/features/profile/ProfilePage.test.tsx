import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfilePage } from "./ProfilePage";
import { MeProfile } from "./api";

// ══════════════════════════════════════════════════════════════════
//  YOUR OWN PROFILE, NOT THE ADMIN'S VIEW OF SOMEONE ELSE'S
//
//  The session persisted at login never carries email or the linked
//  Employee record (login-user/verify-otp don't return them), so this
//  page reads a fresh GET /user/me rather than the auth store — the
//  whole point of the page is showing what the store is missing.
// ══════════════════════════════════════════════════════════════════

const getMe = vi.fn();
vi.mock("./api", () => ({
  profileService: { getMe: () => getMe() },
}));

const baseProfile = (over: Partial<MeProfile> = {}): MeProfile => ({
  id: "u1",
  name: "Priya Sharma",
  email: "priya@t.co",
  role: "production",
  department: "production",
  features: ["/", "/jobs", "/warping"],
  employee: null,
  createdAt: "2025-01-15T00:00:00.000Z",
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getMe.mockReset();
});

describe("ProfilePage", () => {
  it("shows the account's email, role and department", async () => {
    getMe.mockResolvedValue(baseProfile());
    renderPage();

    expect(await screen.findByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("priya@t.co")).toBeInTheDocument();
    // The readable department label appears twice — the header chip and
    // the description-list row — so assert the count rather than a
    // single match.
    expect(screen.getAllByText(/Production \(Warping, Weaving & Covering\)/).length).toBe(2);
  });

  it("shows only the features this login actually has, grouped by section", async () => {
    getMe.mockResolvedValue(baseProfile({ features: ["/jobs"] }));
    renderPage();

    await screen.findByText("Priya Sharma");
    // Granted (explicit or "always") — visible.
    expect(screen.getByText("Job Orders")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument(); // always-on
    // Never granted here, and not admin/finance scope — must not appear.
    expect(screen.queryByText("Purchase Orders")).not.toBeInTheDocument();
  });

  it("marks an always-on feature so it isn't mistaken for something granted specially", async () => {
    getMe.mockResolvedValue(baseProfile({ features: [] }));
    renderPage();

    await screen.findByText("Priya Sharma");
    expect(screen.getAllByText(/always/i).length).toBeGreaterThan(0);
  });

  it("shows work details when an employee record is linked", async () => {
    getMe.mockResolvedValue(
      baseProfile({
        employee: { name: "Priya Sharma", department: "production", phoneNumber: "9876543210", hourlyRate: 85 },
      })
    );
    renderPage();

    expect(await screen.findByText("Work details")).toBeInTheDocument();
    expect(screen.getByText("9876543210")).toBeInTheDocument();
    expect(screen.getByText(/₹85/)).toBeInTheDocument();
  });

  it("skips the work details card when there is no linked employee", async () => {
    getMe.mockResolvedValue(baseProfile({ employee: null }));
    renderPage();

    await screen.findByText("Priya Sharma");
    expect(screen.queryByText("Work details")).not.toBeInTheDocument();
  });

  it("reports the load failure instead of showing a blank page", async () => {
    getMe.mockRejectedValue(new Error("Network down"));
    renderPage();

    expect(await screen.findByText("Network down")).toBeInTheDocument();
  });
});
