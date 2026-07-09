import { cn } from "./cn";

export type ChipTone = "success" | "warning" | "info" | "danger" | "neutral";

// OCP: lifecycle states map to tones via configuration at the call site —
// new statuses never require touching this component.
const toneClasses: Record<ChipTone, string> = {
  success: "bg-status-successBg text-status-success",
  warning: "bg-status-warningBg text-status-warning",
  info: "bg-status-infoBg text-status-info",
  danger: "bg-status-dangerBg text-status-danger",
  neutral: "bg-ink-100 text-ink-600",
};

export interface StatusChipProps {
  tone?: ChipTone;
  children: React.ReactNode;
  className?: string;
}

export function StatusChip({ tone = "neutral", children, className }: StatusChipProps) {
  // Humanize machine strings so raw enums (PENDING_VERIFICATION, half_day)
  // never reach the user.
  if (typeof children === "string") {
    children = children.replace(/_/g, " ");
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
