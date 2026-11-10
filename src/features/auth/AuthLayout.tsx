import { ReactNode } from "react";
import { BrandMark } from "@/components/layout/BrandMark";
import { Card } from "@/components/ui/Card";
import { config } from "@/app/config";

// Shared chrome for the unauthenticated pages (login, forgot-password,
// reset-password) so they stay visually identical.
//
// One calm column: the red J (the one place the brand colour lives), the
// form, and a line on what the app is. It used to be half a screen of
// solid colour beside the form, louder than anything inside the app.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-logo text-white">
            <BrandMark className="h-7 w-7" />
          </span>
          <span className="text-xl font-bold tracking-tight text-ink-900">{config.appName}</span>
        </div>
        <Card className="p-8">{children}</Card>
        <p className="mt-6 text-center text-xs text-ink-500">
          Orders, production, machines, people and payroll, in one place.
        </p>
      </div>
    </div>
  );
}
