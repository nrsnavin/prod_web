import { ReactNode } from "react";
import { PackageOpen } from "lucide-react";


export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /**
   * One line instead of a centred block. For a section INSIDE a detail
   * page: a new order used to spend most of a screen on three
   * 200px-tall panels saying "nothing yet", pushing everything that
   * did have content below the fold. A whole empty list page keeps the
   * full treatment — there, the empty state is the page.
   */
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, compact }: EmptyStateProps) {
  if (compact) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-canvas px-3 py-2.5">
        <span className="shrink-0 text-ink-300 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
          {icon ?? <PackageOpen />}
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-medium text-ink-700">{title}</span>
          {description && <span className="text-ink-400"> — {description}</span>}
        </p>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
  // Calm, not a poster: on a fresh database every list is empty, and
  // half-screen boxes with a big icon made the whole app look broken.
  // The icon is drawn small whatever size it was handed at.
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 text-ink-300 [&>svg]:h-8 [&>svg]:w-8" aria-hidden>
        {icon ?? <PackageOpen />}
      </div>
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
