import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import { ApiError } from "@/core/http/httpClient";

// ══════════════════════════════════════════════════════════════════
//  SIGNING IN WHEN THE CODE CANNOT COME
//
//  Email OTP is the front door, and it has a dependency the person
//  standing at it can neither see nor fix: a working mail server. When
//  that is down the door does not open for anybody, and the password
//  route — which exists on the backend precisely for this — was linked
//  from nowhere. An SMTP outage locked the whole company out of their
//  own ERP with a screen that said "check your email".
//
//  The fallback must be reachable WITHOUT the server's cooperation.
//
//  It was first built to open only in response to something: a 503
//  saying the mailer is down, or a thirty-second timer running out on
//  the code screen. Both of those are the system deciding to let you
//  out, and the case that matters is the one where the system is not
//  behaving as expected — a server that answers 200 and sends nothing,
//  an old build, a misread. A door that opens only when the house is
//  well is not a fire exit.
//
//  So: a plain link on the first screen, always. The two reactive paths
//  stay, because they put someone in the right place with less work,
//  but nothing depends on them any more.
//
//  The password FIELD is still not on the first screen — reaching it is
//  a deliberate second step, and these tests hold that line.
// ══════════════════════════════════════════════════════════════════

const login     = vi.fn();
const requestOtp = vi.fn();
const verifyOtp  = vi.fn();

vi.mock("@/core/auth/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login,
    requestOtp,
    verifyOtp,
    logout: vi.fn(),
  }),
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

const mailerDown = () =>
  new ApiError(
    "Sign-in codes cannot be sent — this server has no email configured.",
    503,
    undefined,
    "MAILER_NOT_CONFIGURED"
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  sessionStorage.clear();
  requestOtp.mockResolvedValue({ message: "sent" });
});

// ──────────────────────────────────────────────────────────────────
describe("the first screen", () => {
  it("asks only for an email — the password field is a second step", async () => {
    renderPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it("offers the password route without being asked", async () => {
    // The point of the whole change: this is reachable with the server
    // saying nothing at all, and without waiting for a timer.
    renderPage();
    expect(
      screen.getByRole("button", { name: /sign in with a password instead/i })
    ).toBeInTheDocument();
  });

  it("goes to the code screen when a code was sent", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
  });
});

describe("taking the password route from the first screen", () => {
  it("reaches the password field", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /sign in with a password instead/i }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("navin@balu.com")).toBeInTheDocument();
  });

  it("never asks the server for a code on the way", async () => {
    // It is the route for when asking is pointless or broken.
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /sign in with a password instead/i }));
    await screen.findByLabelText(/^password$/i);

    expect(requestOtp).not.toHaveBeenCalled();
  });

  it("still insists on a valid email first", async () => {
    // Same validation as the primary button, so the password screen
    // cannot be reached with an empty or malformed address.
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /sign in with a password instead/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it("signs in", async () => {
    login.mockResolvedValue({ id: "1", username: "Navin", role: "admin" });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /sign in with a password instead/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "navin27");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: "navin@balu.com", password: "navin27" })
    );
  });

  it("offers the reset link, since mail may be working fine", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /sign in with a password instead/i }));

    const link = await screen.findByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});

describe("when the server says it cannot send email", () => {
  it("hands over the password form instead of an error to re-read", async () => {
    // Showing "no email configured" and leaving someone on a form whose
    // only button re-runs the thing that just failed is a wall, not a
    // message.
    requestOtp.mockRejectedValue(mailerDown());
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("says whose problem it is", async () => {
    requestOtp.mockRejectedValue(mailerDown());
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/administrator/i)).toBeInTheDocument();
  });

  it("carries the email across, so it is not typed twice", async () => {
    requestOtp.mockRejectedValue(mailerDown());
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    await screen.findByLabelText(/^password$/i);
    expect(screen.getByDisplayValue("navin@balu.com")).toBeInTheDocument();
  });

  it("signs in with the password", async () => {
    requestOtp.mockRejectedValue(mailerDown());
    login.mockResolvedValue({ id: "1", username: "Navin", role: "admin" });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "navin27");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: "navin@balu.com", password: "navin27" })
    );
  });

  it("does not offer a reset link, which arrives the same way", async () => {
    // A password-reset email cannot reach them either. Offering it
    // would be a second dead end dressed as a way out.
    requestOtp.mockRejectedValue(mailerDown());
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    await screen.findByLabelText(/^password$/i);
    expect(screen.queryByRole("link", { name: /forgot password/i })).not.toBeInTheDocument();
  });

  it("shows the reason when the password is wrong too", async () => {
    requestOtp.mockRejectedValue(mailerDown());
    login.mockRejectedValue(new ApiError("Invalid email or password", 401));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await user.type(await screen.findByLabelText(/^password$/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it("still refuses an ordinary error — that one is worth retrying", async () => {
    // Only MAILER_NOT_CONFIGURED means "this route is a dead end". A
    // network blip should not push someone onto the password path.
    requestOtp.mockRejectedValue(new ApiError("Request timed out", 500));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByText(/request timed out/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });
});

describe("when the code simply never arrives", () => {
  async function atTheCodeScreen() {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByLabelText(/6-digit code/i);
    return user;
  }

  it("offers the password route straight away", async () => {
    // This was held back for thirty seconds, so that the honest answer
    // could be "wait a moment". On a machine that never receives the
    // code, those thirty seconds are the whole experience — and someone
    // staring at a screen with no visible way forward is a worse
    // outcome than an alternative offered slightly early.
    await atTheCodeScreen();

    expect(
      screen.getByRole("button", { name: /sign in with your password/i })
    ).toBeInTheDocument();
  });

  it("reaches the password field from there", async () => {
    const user = await atTheCodeScreen();
    await user.click(screen.getByRole("button", { name: /sign in with your password/i }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("keeps the reset link available on that route", async () => {
    // Here the mail server may be working perfectly and the person
    // simply cannot remember their password — which is exactly what
    // forgot-password is for. The page existed and nothing in the app
    // linked to it.
    const user = await atTheCodeScreen();
    await user.click(screen.getByRole("button", { name: /sign in with your password/i }));

    const link = await screen.findByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("still counts the resend cooldown down", async () => {
    // The cooldown is about not hammering the mail server; it was never
    // about hiding the fallback, and it stays.
    await atTheCodeScreen();
    expect(screen.getByText(/resend in/i)).toBeInTheDocument();
  });
});

describe("getting back", () => {
  it("returns to the email screen from the password screen", async () => {
    requestOtp.mockRejectedValue(mailerDown());
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByLabelText(/^password$/i);

    await user.click(screen.getByRole("button", { name: /back to sign-in/i }));

    expect(await screen.findByRole("button", { name: /send code/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });
});
