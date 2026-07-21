import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { authService } from "@/core/auth/authService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/core/http/httpClient";
import { AuthLayout } from "./AuthLayout";

const schema = z
  .object({
    password: z.string().min(4, "Password must be at least 4 characters"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });
type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;

  // A link with no token is unusable — send them to request a fresh one.
  if (!token) {
    return (
      <AuthLayout>
        <h2 className="text-xl font-bold">Invalid reset link</h2>
        <p className="mt-2 text-sm text-ink-400">
          This link is missing its token. Request a new password reset link to
          continue.
        </p>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Request a new link
        </Link>
      </AuthLayout>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await authService.resetPassword(token, values.password);
      setDone(true);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Couldn't reset password — try again."
      );
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <div className="text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-successBg">
            <CheckCircle2 className="h-6 w-6 text-status-success" />
          </span>
          <h2 className="text-xl font-bold">Password updated</h2>
          <p className="mt-2 text-sm text-ink-400">
            Your password has been changed. You can now sign in with your new
            password.
          </p>
          <Button size="lg" className="mt-6 w-full" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-xl font-bold">Choose a new password</h2>
      <p className="mt-1 text-sm text-ink-400">
        Enter a new password for your ERP account.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register("password")}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirm?.message}
          {...register("confirm")}
        />

        {serverError && (
          <p className="text-sm text-status-danger bg-status-dangerBg rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Reset password
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
