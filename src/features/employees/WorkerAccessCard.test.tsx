import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiError } from "@/core/http/httpClient";
import { WorkerAccessCard, pinProblem, suggestPin } from "./WorkerAccessCard";
import type { WorkerAccess } from "./workerAccess";

// ══════════════════════════════════════════════════════════════════
//  APP ACCESS — how an admin gives a worker phone + PIN sign-in
//
//  Held here: the PIN rules match the server's; the card says plainly
//  what the worker has; the PIN is shown once, after it is set; a
//  manager login is never offered a PIN.
// ══════════════════════════════════════════════════════════════════

const get = vi.fn();
const setPin = vi.fn();
const turnOff = vi.fn();
vi.mock("./workerAccess", () => ({
  workerAccessService: {
    get: (id: string) => get(id),
    setPin: (id: string, pin: string) => setPin(id, pin),
    turnOff: (id: string) => turnOff(id),
  },
}));

const employee = { id: "e1", name: "Ravi", phoneNumber: "9876543210", department: "weaving" };
const workerLogin = (over: Partial<NonNullable<WorkerAccess["login"]>> = {}): WorkerAccess["login"] => ({
  id: "u1", email: null, selfService: true, phoneSignIn: true, lockedUntil: null, since: "2026-09-01T00:00:00Z", ...over,
});

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <WorkerAccessCard empId="e1" />
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("the PIN rules", () => {
  it.each([
    ["12", /4 to 6 digits/],
    ["12a4", /4 to 6 digits/],
    ["7777", /one digit repeated/],
    ["3456", /run of digits/],
    ["654321", /run of digits/],
    ["3210", /run of digits|end of the phone/],
  ])("refuse %s", (pin, why) => {
    expect(pinProblem(pin, "9876543210")).toMatch(why);
  });

  it("accept an ordinary PIN", () => {
    expect(pinProblem("4826", "9876543210")).toBeNull();
    expect(pinProblem("193746", "9876543210")).toBeNull();
  });

  it("suggest only PINs they accept", () => {
    for (let i = 0; i < 200; i++) expect(pinProblem(suggestPin("9876543210"), "9876543210")).toBeNull();
  });
});

describe("the card", () => {
  it("offers access to a worker who has none, and shows the PIN once", async () => {
    get.mockResolvedValue({ employee, login: null });
    setPin.mockResolvedValue({ employee, login: workerLogin() });
    renderCard();

    expect(await screen.findByText(/can't sign in to the app yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /give app access/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^pin$/i), "4826");
    await userEvent.click(within(dialog).getByRole("button", { name: /set pin/i }));

    await waitFor(() => expect(setPin).toHaveBeenCalledWith("e1", "4826"));
    expect(await within(dialog).findByTestId("given-pin")).toHaveTextContent("4826");
    expect(within(dialog).getByText(/won't be shown again/)).toBeInTheDocument();
    // A first PIN: nobody was signed out, and the dialog says what it did.
    expect(within(dialog).queryByText(/signed out/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /give app access/i })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /done/i }));
    expect(await screen.findByText(/signs in with/i)).toHaveTextContent("98765 43210");
    expect(screen.queryByText("4826")).not.toBeInTheDocument();
  });

  it("catches a weak PIN before sending it", async () => {
    get.mockResolvedValue({ employee, login: null });
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: /give app access/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^pin$/i), "1234");
    await userEvent.click(within(dialog).getByRole("button", { name: /set pin/i }));
    expect(await within(dialog).findByText(/run of digits/)).toBeInTheDocument();
    expect(setPin).not.toHaveBeenCalled();
  });

  it("shows the server's refusal in the dialog", async () => {
    get.mockResolvedValue({ employee, login: null });
    setPin.mockRejectedValue(new ApiError("Kumar has the same phone number.", 409));
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: /give app access/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^pin$/i), "4826");
    await userEvent.click(within(dialog).getByRole("button", { name: /set pin/i }));
    expect(await within(dialog).findByText(/same phone number/)).toBeInTheDocument();
  });

  it("says when a login is locked, and offers the reset that unlocks it", async () => {
    get.mockResolvedValue({ employee, login: workerLogin({ lockedUntil: "2099-01-01T00:00:00Z" }) });
    renderCard();
    expect(await screen.findByText(/locked after wrong pins/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset pin and unlock/i })).toBeInTheDocument();
  });

  it("turns phone sign-in off after asking", async () => {
    get.mockResolvedValue({ employee, login: workerLogin() });
    turnOff.mockResolvedValue({ employee, login: workerLogin({ phoneSignIn: false }) });
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: /turn off/i }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/signed out on every phone/);
    await userEvent.click(within(dialog).getByRole("button", { name: /turn off/i }));
    await waitFor(() => expect(turnOff).toHaveBeenCalledWith("e1"));
    expect(await screen.findByText(/phone sign-in is off/)).toBeInTheDocument();
  });

  it("asks for a phone number before anything else", async () => {
    get.mockResolvedValue({ employee: { ...employee, phoneNumber: null }, login: null });
    renderCard();
    expect(await screen.findByText(/add a 10-digit phone number/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /give app access/i })).not.toBeInTheDocument();
  });

  it("never offers a PIN to a manager login", async () => {
    get.mockResolvedValue({ employee, login: workerLogin({ selfService: false, phoneSignIn: false, email: "ravi@co.in" }) });
    renderCard();
    expect(await screen.findByText(/manager login/)).toHaveTextContent("ravi@co.in");
    expect(screen.queryByRole("button", { name: /give app access|reset pin/i })).not.toBeInTheDocument();
  });
});
