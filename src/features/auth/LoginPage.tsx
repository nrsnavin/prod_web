import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate, Navigate, Link } from "react-router-dom";
import { Factory } from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { SESSION_EXPIRED_KEY } from "@/core/auth/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { ApiError } from "@/core/http/httpClient";
import { config } from "@/app/config";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const sessionExpired = sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      sessionStorage.removeItem(SESSION_EXPIRED_KEY);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "Login failed — try again."
      );
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-500 text-white p-12">
        <div className="flex items-center gap-2.5">
          <span className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center">
            <Factory className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">
            {config.appName}
          </span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight max-w-md">
            Run your elastic factory from one screen.
          </h1>
          <p className="mt-4 text-white/80 max-w-md">
            Orders, production, machines, people and payroll — everything the
            mobile app does, now on the big screen.
          </p>
        </div>
        <p className="text-sm text-white/60">
          © {new Date().getFullYear()} — Internal ERP
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 bg-canvas">
        <Card className="w-full max-w-sm p-8">
          <h2 className="text-xl font-bold">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-400">
            Sign in with your ERP account
          </p>

          {sessionExpired && (
            <p className="mt-3 rounded-lg bg-status-warningBg px-3 py-2 text-sm text-status-warning">
              Your session expired — please sign in again.
            </p>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register("password")}
            />

            <div className="flex justify-end -mt-1">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-brand-500 hover:text-brand-600"
              >
                Forgot password?
              </Link>
            </div>

            {serverError && (
              <p className="text-sm text-status-danger bg-status-dangerBg rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
