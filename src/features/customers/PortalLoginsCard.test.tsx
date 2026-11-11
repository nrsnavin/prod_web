import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { PortalLoginsCard } from "./PortalLoginsCard";
import { newPortalPassword, type PortalLogin } from "./portalLogins";

// Who at a customer can sign in to the portal: made here with a password
// shown once, given a new one, switched off and on, removed.

const svc = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
vi.mock("./portalLogins", async (importActual) => ({
  ...(await importActual<typeof import("./portalLogins")>()),
  portalLoginService: {
    list: (...a: unknown[]) => svc.list(...a),
    create: (...a: unknown[]) => svc.create(...a),
    update: (...a: unknown[]) => svc.update(...a),
    remove: (...a: unknown[]) => svc.remove(...a),
  },
}));

const priya: PortalLogin = { _id: "u1", name: "Priya", email: "priya@acme.test", role: "buyer", status: "active", lastLoginAt: "2026-11-02T10:00:00Z" };

const open = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <PortalLoginsCard customerId="c1" customerName="Acme Garments" />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()));

describe("a customer's portal logins", () => {
  it("lists who can sign in, with their role and when they last did", async () => {
    svc.list.mockResolvedValue([priya, { ...priya, _id: "u2", name: "Ravi", email: "ravi@acme.test", role: "viewer", status: "disabled", lastLoginAt: null }]);
    open();
    const list = await screen.findByRole("list", { name: "Portal logins" });
    expect(within(list).getByText("Priya")).toBeInTheDocument();
    expect(within(list).getByText(/priya@acme.test · last signed in/)).toBeInTheDocument();
    expect(within(list).getByText("Viewer")).toBeInTheDocument();
    expect(within(list).getByText("Switched off")).toBeInTheDocument();
    expect(within(list).getByText(/has not signed in yet/)).toBeInTheDocument();
    expect(screen.getByText(/sign in at/i)).toHaveTextContent("portal.baluelastics.com");
  });

  it("says when nobody can sign in yet", async () => {
    svc.list.mockResolvedValue([]);
    open();
    expect(await screen.findByText("No one at this customer can sign in yet.")).toBeInTheDocument();
  });

  it("makes a login with a password it shows once", async () => {
    svc.list.mockResolvedValue([]);
    svc.create.mockImplementation(async (_c: string, body: { name: string; email: string; password: string }) => ({ ...priya, name: body.name, email: body.email }));
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: /add login/i }));
    const dialog = await screen.findByRole("dialog");
    const add = within(dialog).getByRole("button", { name: "Add login" });
    expect(add).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Name"), "Priya");
    await user.type(within(dialog).getByLabelText("Email"), "Priya@Acme.test");
    await user.selectOptions(within(dialog).getByLabelText("What they can see"), "accountant");
    await user.click(add);

    expect(svc.create).toHaveBeenCalledTimes(1);
    const [customerId, body] = svc.create.mock.calls[0];
    expect(customerId).toBe("c1");
    expect(body).toMatchObject({ name: "Priya", email: "priya@acme.test", role: "accountant" });
    expect(body.password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);

    const shown = await screen.findByRole("dialog", { name: /Priya can sign in/ });
    expect(within(shown).getByLabelText("Password")).toHaveTextContent(body.password);
  });

  it("gives a new password only once asked, and switches a login off", async () => {
    svc.list.mockResolvedValue([priya]);
    svc.update.mockImplementation(async (_c: string, _u: string, body: { status?: string }) => ({ success: true, sessionsEnded: true, user: { ...priya, ...(body.status ? { status: body.status } : {}) } }));
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "New password for Priya" }));
    expect(svc.update).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Make a new password" }));
    expect(svc.update).toHaveBeenCalledWith("c1", "u1", { password: expect.stringMatching(/^\w{4}-\w{4}-\w{4}$/) });
    expect(await screen.findByRole("dialog", { name: /Priya's new password/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));

    await user.click(screen.getByRole("button", { name: "Switch off Priya" }));
    expect(svc.update).toHaveBeenLastCalledWith("c1", "u1", { status: "disabled" });
  });

  it("removes a login only after asking", async () => {
    svc.list.mockResolvedValue([priya]);
    svc.remove.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("button", { name: "Remove Priya" }));
    expect(svc.remove).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Remove login" }));
    expect(svc.remove).toHaveBeenCalledWith("c1", "u1");
  });
});

describe("the password made for a login", () => {
  it("is 12 letters and digits in three groups, never 0, O, 1, l or I", () => {
    const p = newPortalPassword();
    expect(p).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
    expect(p).not.toMatch(/[01OlI]/);
    const all = new Set(Array.from({ length: 50 }, () => newPortalPassword()));
    expect(all.size).toBe(50);
  });
});
