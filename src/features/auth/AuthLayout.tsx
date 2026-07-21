import { ReactNode } from "react";
import { Factory } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { config } from "@/app/config";

// Shared split-screen chrome for the unauthenticated pages (login,
// forgot-password, reset-password) so they stay visually identical.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-500 text-white p-12">
        <div className="flex items-center gap-2.5">
          <span className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center">
            <Factory className="h-5 w-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">{config.appName}</span>
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
        <p className="text-sm text-white/60">© {new Date().getFullYear()} — Internal ERP</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 bg-canvas">
        <Card className="w-full max-w-sm p-8">{children}</Card>
      </div>
    </div>
  );
}
