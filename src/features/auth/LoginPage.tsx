import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { SESSION_EXPIRED_KEY } from "@/core/auth/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/core/http/httpClient";
import { AuthLayout } from "./AuthLayout";

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

export function LoginPage() {
  const { isAuthenticated, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const sessionExpired = sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";

  const goToCode = (forEmail: string) => {
    setEmail(forEmail);
    setStep("code");
    setResendIn(30); // throttle the visible "resend" affordance
  };

  return (
    <AuthLayout>
      {step === "email" ? (
        <EmailStep
          sessionExpired={sessionExpired}
          serverError={serverError}
          setServerError={setServerError}
          onSent={goToCode}
          requestOtp={requestOtp}
        />
      ) : (
        <CodeStep
          email={email}
          serverError={serverError}
          setServerError={setServerError}
          resendIn={resendIn}
          setResendIn={setResendIn}
          requestOtp={requestOtp}
          onBack={() => {
            setStep("email");
            setServerError(null);
          }}
          onVerified={async (otp) => {
            await verifyOtp(email, otp);
            sessionStorage.removeItem(SESSION_EXPIRED_KEY);
            const from = (location.state as { from?: string } | null)?.from ?? "/";
            navigate(from, { replace: true });
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
  requestOtp,
}: {
  sessionExpired: boolean;
  serverError: string | null;
  setServerError: (v: string | null) => void;
  onSent: (email: string) => void;
  requestOtp: (email: string) => Promise<{ message: string }>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });

  const onSubmit = async (values: EmailValues) => {
    setServerError(null);
    try {
      await requestOtp(values.email.trim());
      onSent(values.email.trim());
    } catch (err) {
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
  onBack,
  onVerified,
}: {
  email: string;
  serverError: string | null;
  setServerError: (v: string | null) => void;
  resendIn: number;
  setResendIn: Dispatch<SetStateAction<number>>;
  requestOtp: (email: string) => Promise<{ message: string }>;
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
    </>
  );
}
