import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { SESSION_EXPIRED_KEY } from "@/core/auth/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/core/http/httpClient";
import { AuthLayout } from "./AuthLayout";

// ══════════════════════════════════════════════════════════════════
//  SIGNING IN WHEN THE CODE CANNOT COME
//
//  Email OTP is the front door and stays the front door. But it has a
//  dependency the user cannot see or fix — a working mail server — and
//  when that dependency is down the door does not open for anybody. The
//  password route exists on the backend for exactly this (/login-user,
//  kept mounted as an emergency fallback) and nothing linked to it, so
//  an SMTP outage locked the whole company out of their own ERP.
//
//  It is reachable three ways:
//
//    1. A link on the first screen. This was left out at first, on the
//       reasoning that an advertised password route undoes the reason
//       OTP is primary. That reasoning was wrong in the way that
//       matters: the two automatic paths below both depend on the
//       server behaving in a particular way, and when it did not, the
//       fallback was unreachable — a way out that only opens when the
//       system is well enough to open it is not a way out. It is a
//       text link under the primary button, not a password field: the
//       default action is still "send me a code".
//
//    2. The server says outright that it cannot send. /request-otp
//       answers 503 MAILER_NOT_CONFIGURED when the box has no SMTP
//       settings — a definite answer, so we go straight to the password
//       form rather than making someone read an error and guess.
//
//    3. On the code screen, for the case where SMTP is configured but
//       the send fails: the server deliberately answers 200 and says
//       nothing, since a failure raised only for addresses that HAVE an
//       account would name them. Nothing can tell this screen, so the
//       link sits there from the moment the screen opens.
//
//  The password FIELD is still never on the first screen — reaching it
//  is a deliberate second step.
// ══════════════════════════════════════════════════════════════════

// ── Step 1: email ───────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
type EmailValues = z.infer<typeof emailSchema>;

// ── Step 2: 6-digit code ────────────────────────────────────────────────
const otpSchema = z.object({
  otp: z
    .string()
    .min(1, "Enter the 6-digit code")
    .regex(/^\d{6}$/, "The code is 6 digits"),
});
type OtpValues = z.infer<typeof otpSchema>;

// ── Fallback: password ──────────────────────────────────────────────────
const passwordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});
type PasswordValues = z.infer<typeof passwordSchema>;

/** The server telling us it has no mailer at all. */
export const MAILER_NOT_CONFIGURED = "MAILER_NOT_CONFIGURED";

type Step = "email" | "code" | "password";

export function LoginPage() {
  const { isAuthenticated, login, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  // Why we are on the password screen — the two routes there want
  // different words. "The server cannot send codes" is a fact worth
  // stating; "you said the code never came" is not.
  const [mailerDown, setMailerDown] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const sessionExpired = sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";

  const goToCode = (forEmail: string) => {
    setEmail(forEmail);
    setStep("code");
    setResendIn(30); // throttle the visible "resend" affordance
  };

  const goToPassword = (forEmail: string, becauseMailerIsDown: boolean) => {
    setEmail(forEmail);
    setMailerDown(becauseMailerIsDown);
    setServerError(null);
    setStep("password");
  };

  const finishSignIn = () => {
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    navigate(from, { replace: true });
  };

  return (
    <AuthLayout>
      {step === "email" && (
        <EmailStep
          sessionExpired={sessionExpired}
          serverError={serverError}
          setServerError={setServerError}
          onSent={goToCode}
          onMailerUnavailable={(forEmail) => goToPassword(forEmail, true)}
          onUsePassword={(forEmail) => goToPassword(forEmail, false)}
          requestOtp={requestOtp}
        />
      )}

      {step === "code" && (
        <CodeStep
          email={email}
          serverError={serverError}
          setServerError={setServerError}
          resendIn={resendIn}
          setResendIn={setResendIn}
          requestOtp={requestOtp}
          onUsePassword={() => goToPassword(email, false)}
          onBack={() => {
            setStep("email");
            setServerError(null);
          }}
          onVerified={async (otp) => {
            await verifyOtp(email, otp);
            finishSignIn();
          }}
        />
      )}

      {step === "password" && (
        <PasswordStep
          email={email}
          mailerDown={mailerDown}
          serverError={serverError}
          setServerError={setServerError}
          onBack={() => {
            setStep("email");
            setServerError(null);
          }}
          onSubmit={async (password) => {
            await login({ email, password });
            finishSignIn();
          }}
        />
      )}
    </AuthLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function EmailStep({
  sessionExpired,
  serverError,
  setServerError,
  onSent,
  onMailerUnavailable,
  onUsePassword,
  requestOtp,
}: {
  sessionExpired: boolean;
  serverError: string | null;
  setServerError: (v: string | null) => void;
  onSent: (email: string) => void;
  onMailerUnavailable: (email: string) => void;
  onUsePassword: (email: string) => void;
  requestOtp: (email: string) => Promise<{ message: string }>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });

  const onSubmit = async (values: EmailValues) => {
    setServerError(null);
    const address = values.email.trim();
    try {
      await requestOtp(address);
      onSent(address);
    } catch (err) {
      // A server with no mailer is a dead end for this route, not an
      // error to retry. Showing "no email configured" and leaving
      // someone on a form whose only button re-runs the thing that just
      // failed is a wall, not a message — so hand them the other door
      // instead of describing the locked one.
      if (err instanceof ApiError && err.code === MAILER_NOT_CONFIGURED) {
        onMailerUnavailable(address);
        return;
      }
      setServerError(err instanceof ApiError ? err.message : "Couldn't send the code — try again.");
    }
  };

  return (
    <>
      <h2 className="text-xl font-bold">Sign in</h2>
      <p className="mt-1 text-sm text-ink-400">
        Enter your account email and we'll send you a sign-in code.
      </p>

      {sessionExpired && (
        <p className="mt-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
          Your session expired — please sign in again.
        </p>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register("email")}
        />

        {serverError && (
          <p className="text-sm text-status-danger bg-status-dangerBg rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Send code
        </Button>
      </form>

      {/*
        Routed through the SAME validation as the primary button, so the
        email is checked once and cannot arrive at the password screen
        empty or malformed. handleSubmit validates and only then calls
        through, which is why this is a submit-shaped handler rather
        than a bare onClick reading the field.
      */}
      <p className="mt-5 border-t border-ink-100 pt-4 text-center text-sm text-ink-400">
        <button
          type="button"
          onClick={handleSubmit((values) => onUsePassword(values.email.trim()))}
          className="font-medium text-brand-500 hover:text-brand-600"
        >
          Sign in with a password instead
        </button>
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CodeStep({
  email,
  serverError,
  setServerError,
  resendIn,
  setResendIn,
  requestOtp,
  onUsePassword,
  onBack,
  onVerified,
}: {
  email: string;
  serverError: string | null;
  setServerError: (v: string | null) => void;
  resendIn: number;
  setResendIn: Dispatch<SetStateAction<number>>;
  requestOtp: (email: string) => Promise<{ message: string }>;
  onUsePassword: () => void;
  onBack: () => void;
  onVerified: (otp: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpValues>({ resolver: zodResolver(otpSchema) });
  const [resending, setResending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  // Count the resend cooldown down to zero.
  useEffect(() => {
    timer.current = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: OtpValues) => {
    setServerError(null);
    try {
      await onVerified(values.otp.trim());
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Invalid or expired code — request a new one."
      );
    }
  };

  const resend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setServerError(null);
    try {
      await requestOtp(email);
      setResendIn(30);
    } catch {
      setServerError("Couldn't resend the code — try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-50">
        <MailCheck className="h-6 w-6 text-brand-500" />
      </span>
      <h2 className="text-xl font-bold">Enter your code</h2>
      <p className="mt-1 text-sm text-ink-400">
        We sent a 6-digit code to <span className="font-medium text-ink-600">{email}</span>. It
        expires in 10 minutes.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="6-digit code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          className="tracking-[0.5em] text-center text-lg"
          error={errors.otp?.message}
          {...register("otp")}
        />

        {serverError && (
          <p className="text-sm text-status-danger bg-status-dangerBg rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Verify &amp; sign in
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-medium text-brand-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Change email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0 || resending}
          className="font-medium text-brand-500 hover:text-brand-600 disabled:text-ink-300 disabled:cursor-not-allowed"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : resending ? "Sending…" : "Resend code"}
        </button>
      </div>

      {/*
        The silent failure. When SMTP is configured but the send fails,
        the server answers 200 and says nothing — deliberately, because a
        failure raised only for addresses that have an account would name
        them. So nothing can tell this screen the code is never coming,
        and the way out has to be one the person reaches for.

        This was held back until the resend cooldown expired, on the
        grounds that before then the honest answer is "wait a moment".
        The cost of being wrong about that is someone staring at a
        screen with no way forward, which is worse than the cost of
        offering an alternative thirty seconds early — and on a machine
        that never receives the code, those thirty seconds are the whole
        experience.
      */}
      <p className="mt-5 border-t border-ink-100 pt-4 text-center text-sm text-ink-400">
        Didn't get it?{" "}
        <button
          type="button"
          onClick={onUsePassword}
          className="font-medium text-brand-500 hover:text-brand-600"
        >
          Sign in with your password
        </button>
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function PasswordStep({
  email,
  mailerDown,
  serverError,
  setServerError,
  onBack,
  onSubmit,
}: {
  email: string;
  mailerDown: boolean;
  serverError: string | null;
  setServerError: (v: string | null) => void;
  onBack: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const submit = async (values: PasswordValues) => {
    setServerError(null);
    try {
      await onSubmit(values.password);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Couldn't sign you in — try again."
      );
    }
  };

  return (
    <>
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-50">
        <KeyRound className="h-6 w-6 text-brand-500" />
      </span>
      <h2 className="text-xl font-bold">Sign in with your password</h2>

      {mailerDown ? (
        // Worth stating plainly: it is not their email that is broken,
        // and it is not something they can fix by trying again. It also
        // tells whoever runs the server what to go and look at.
        <p className="mt-1 text-sm text-ink-400">
          This server can't send sign-in codes at the moment — its email isn't set up. Use
          your password instead, and let your administrator know.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-400">
          Signing in as <span className="font-medium text-ink-600">{email}</span>.
        </p>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        {/* Present and readable, so a password manager can match the
            credential to the account — and so the person can see which
            account they are signing in to. Not editable here: it was
            given on the previous screen, and two places to change it is
            one too many. */}
        <Input label="Email" type="email" value={email} readOnly disabled />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          autoFocus
          error={errors.password?.message}
          {...register("password")}
        />

        {serverError && (
          <p className="text-sm text-status-danger bg-status-dangerBg rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-medium text-brand-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign-in
        </button>

        {/*
          This page existed and nothing in the app linked to it — the
          same way /login-user existed and nothing linked to THAT. Here
          is where it belongs: the one screen where somebody is being
          asked for a password they may not remember.

          Withheld when the server has told us it cannot send email,
          because a reset link arrives the same way a sign-in code does.
          Offering it there would be a second dead end dressed as a way
          out, and the person would spend another few minutes on it
          before reaching the same place.
        */}
        {!mailerDown && (
          <Link
            to="/forgot-password"
            className="font-medium text-brand-500 hover:text-brand-600"
          >
            Forgot password?
          </Link>
        )}
      </div>
    </>
  );
}
