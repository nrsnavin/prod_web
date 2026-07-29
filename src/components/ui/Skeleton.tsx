import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-ink-100",
        "after:absolute after:inset-0 after:-translate-x-full",
        // The sheen has to stay *lighter* than the base in both themes; a
        // flat white/70 reads as a harsh strobe against a dark placeholder.
        "after:bg-gradient-to-r after:from-transparent after:via-[var(--skeleton-sheen)] after:to-transparent",
        "after:animate-[shimmer_1.4s_infinite]",
        className
      )}
    />
  );
}
