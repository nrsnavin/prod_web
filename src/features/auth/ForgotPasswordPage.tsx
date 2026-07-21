import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { authService } from "@/core/auth/authService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/core/http/httpClient";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authService.forgotPassword(values.email.trim());
      setSent(true);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Something went wrong — try again."
      );
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-successBg">
            <MailCheck className="h-6 w-6 text-status-success" />
          </span>
          <h2 className="text-xl font-bold">Check your email</h2>
          <p className="mt-2 text-sm text-ink-400">
            If an account exists for that email, we've sent a link to reset your
            password. The link expires in 30 minutes.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-bold">Forgot your password?</h2>
      <p className="mt-1 text-sm text-ink-400">
        Enter your account email and we'll send you a reset link.
      </p>

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
          Send reset link
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthLayout>
  );
}
