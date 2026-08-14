import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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
//  The fallback has to be reachable in BOTH failure modes, and they are
//  not alike:
//
//    • the server SAYS it cannot send (503 MAILER_NOT_CONFIGURED) — a
//      definite answer, so take them straight there
//
//    • the code just never turns up. The server answers 200 and says
//      nothing, deliberately: a failure raised only for addresses that
//      have an account would name them. Nothing can tell the screen, so
//      the way out must be one the person reaches for.
//
//  And the thing it must NOT do: put a password box on the first
//  screen. That would quietly undo the reason OTP is primary.
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
  it("asks only for an email", async () => {
    renderPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("goes to the code screen when a code was sent", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
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
  // Fake timers: the resend cooldown is a real 30-second interval, and
  // waiting it out for each case put a minute on the suite for no extra
  // confidence. The clock is the thing under test here, so driving it
  // directly is also the more honest test.
  async function atTheCodeScreen() {
    // `shouldAdvanceTime` keeps the clock ticking in real time, so
    // testing-library's findBy* still resolves; advanceTimersByTime then
    // jumps the 30 seconds we do not want to sit through.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await user.type(screen.getByLabelText(/email/i), "navin@balu.com");
    await user.click(screen.getByRole("button", { name: /send code/i }));
    await screen.findByLabelText(/6-digit code/i);
    return user;
  }

  /** Run the cooldown out. The countdown sets state on every tick, so
   *  the jump belongs inside act(). */
  const waitOut = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
  };

  it("hides the way out while the code may still be seconds away", async () => {
    // Offering a way around a code that has just been sent would train
    // people past the primary sign-in for no reason.
    await atTheCodeScreen();
    expect(screen.queryByRole("button", { name: /sign in with your password/i }))
      .not.toBeInTheDocument();
    expect(screen.getByText(/resend in/i)).toBeInTheDocument();
  });

  it("offers it once waiting has plainly not worked", async () => {
    const user = await atTheCodeScreen();
    await waitOut();

    expect(screen.getByRole("button", { name: /resend code/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /sign in with your password/i }));

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("keeps the reset link available on that route", async () => {
    // Here the mail server may be working perfectly and the person
    // simply cannot remember their password — which is exactly what
    // forgot-password is for. The page existed and nothing in the app
    // linked to it.
    const user = await atTheCodeScreen();
    await waitOut();
    await user.click(screen.getByRole("button", { name: /sign in with your password/i }));

    const link = await screen.findByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
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
