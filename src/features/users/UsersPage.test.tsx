import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserFormScreen } from "./UsersPage";
import type { ManagedUser } from "./api";

// ══════════════════════════════════════════════════════════════════
//  SAVING A USER WITH NO ACCESS IS A DECISION, NOT A SLIP
//
//  An empty feature list now means "granted nothing" on the backend —
//  every gated module 403s. That is enforced silently, so the person
//  just meets errors. The form has to say so before it happens.
//
//  The always-on features (Dashboard, Ask Jarvis, Settings…) are never
//  gated and their checkboxes are disabled, so what decides whether a
//  login can open anything is the OPTIONAL set — which is what the
//  warning keys off.
// ══════════════════════════════════════════════════════════════════

const updateFn = vi.fn().mockResolvedValue({ success: true });
const createFn = vi.fn().mockResolvedValue({ success: true });
const toast = vi.fn();

vi.mock("./api", () => ({
  usersService: {
    update: (id: string, body: unknown) => updateFn(id, body),
    create: (body: unknown) => createFn(body),
  },
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ toast }) }));

const managed = (over: Partial<ManagedUser> = {}): ManagedUser =>
  ({
    _id: "u1",
    name: "Priya Sharma",
    email: "priya@t.co",
    role: "production",
    department: "production",
    features: ["/jobs"],
    ...over,
  }) as ManagedUser;

function renderForm(user: ManagedUser | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <UserFormScreen user={user} onClose={() => {}} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  updateFn.mockClear();
  createFn.mockClear();
  toast.mockClear();
});

describe("UserFormScreen — no-access confirmation", () => {
  it("saves straight away when the user keeps at least one module", async () => {
    renderForm(managed());
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.queryByText(/save with no access/i)).not.toBeInTheDocument();
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  it("warns instead of saving when the last module is unticked", async () => {
    renderForm(managed());
    // Drop the only granted feature.
    await userEvent.click(screen.getByRole("checkbox", { name: /job orders/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/save with no access\?/i)).toBeInTheDocument();
    // Nothing has been sent yet — the admin can still back out.
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("names the consequence rather than asking a vague 'are you sure'", async () => {
    renderForm(managed());
    await userEvent.click(screen.getByRole("checkbox", { name: /job orders/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(/only be able to open the always-on screens/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Priya Sharma/)).toBeInTheDocument();
  });

  it("cancelling leaves the account untouched", async () => {
    renderForm(managed());
    await userEvent.click(screen.getByRole("checkbox", { name: /job orders/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await screen.findByText(/save with no access\?/i);

    // Scope to the dialog: the form behind it has its own Cancel button.
    const dialog = screen.getByRole("dialog", { name: /save with no access/i });
    await userEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(updateFn).not.toHaveBeenCalled();
  });

  it("confirming goes through and sends the empty grant", async () => {
    renderForm(managed());
    await userEvent.click(screen.getByRole("checkbox", { name: /job orders/i }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await screen.findByText(/save with no access\?/i);

    await userEvent.click(screen.getByRole("button", { name: /save with no access/i }));

    expect(updateFn).toHaveBeenCalledTimes(1);
    const [, body] = updateFn.mock.calls[0];
    // Only always-on keys may remain — no optional module was granted.
    expect((body as { features: string[] }).features).not.toContain("/jobs");
  });

  // A user whose stored list carries the always-on keys reads as "granted
  // nothing" too: those are never gated, so the outcome is identical.
  it("treats an always-on-only list as no access", async () => {
    renderForm(managed({ features: ["/", "/settings"] }));
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/save with no access\?/i)).toBeInTheDocument();
    expect(updateFn).not.toHaveBeenCalled();
  });
});
