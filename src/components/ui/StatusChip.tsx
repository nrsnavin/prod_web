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
  /**
   * The small dot before the words. It gives the state a shape as well as
   * a colour, so it reads without colour too. On by default, off for a
   * bare number (a count chip is not a state).
   */
  dot?: boolean;
}

/**
 * Words the server sends in capitals that are plain words, not
 * abbreviations. Everything else in capitals (IRN, GST, DC) is left as
 * it came.
 */
const SHOUTED_WORDS = new Set(["DAY", "NIGHT", "LOW"]);

/** "in_production" → "in production"; "NIGHT" → "Night". */
export function chipText(value: string): string {
  const spaced = value.replace(/_/g, " ");
  if (SHOUTED_WORDS.has(spaced)) return spaced.charAt(0) + spaced.slice(1).toLowerCase();
  return spaced;
}

/**
 * A state in sentence case with a dot. It used to be all capitals with
 * wide tracking, which slows reading and makes every row shout; the
 * capitals were CSS, so the text itself (and every test that reads it)
 * is unchanged. The first letter is raised by CSS for the same reason.
 */
export function StatusChip({ tone = "neutral", children, className, dot }: StatusChipProps) {
  if (typeof children === "string") children = chipText(children);
  const showDot = dot ?? typeof children !== "number";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {showDot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      <span className="inline-block first-letter:uppercase">{children}</span>
    </span>
  );
}
