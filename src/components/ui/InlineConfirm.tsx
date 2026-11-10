import { ReactNode, useEffect, useRef, useState } from "react";
import { Button, ButtonProps } from "./Button";
import { cn } from "./cn";

// ══════════════════════════════════════════════════════════════════
//  CONFIRM IN PLACE
//
//  For a small action on one record that can't be undone: removing a
//  loom sensor, sending one supplier a chaser, withdrawing a claim.
//  A dialog is too heavy for these and one click is too light. The
//  button turns into its own question where it stands; the safe answer
//  takes focus, and Esc backs out.
// ══════════════════════════════════════════════════════════════════

export interface InlineConfirmProps {
  /** The button as it first appears: "Remove". */
  children: ReactNode;
  /** The question once pressed: "Remove sensor S-04?" */
  question: ReactNode;
  /** The action's words: "Remove S-04". Says what happens. */
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  /** Red action button, for a removal. */
  danger?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  /** For an icon-only first button. */
  "aria-label"?: string;
  title?: string;
  className?: string;
}

export function InlineConfirm({
  children,
  question,
  confirmLabel,
  onConfirm,
  loading,
  danger,
  variant = "ghost",
  size = "sm",
  disabled,
  "aria-label": ariaLabel,
  title,
  className,
}: InlineConfirmProps) {
  const [asking, setAsking] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (asking) keepRef.current?.focus();
    // Back to the first button after backing out, so the keyboard user
    // is where they were.
    else if (wasAsking.current) firstRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <Button
        ref={firstRef}
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        title={title}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setAsking(true);
        }}
      >
        {children}
      </Button>
    );
  }

  return (
    <span
      role="group"
      aria-label={typeof question === "string" ? question : confirmLabel}
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setAsking(false);
        }
      }}
    >
      <span className="text-sm font-medium text-ink-900">{question}</span>
      <Button
        type="button"
        size={size}
        variant={danger ? "danger" : "primary"}
        loading={loading}
        onClick={() => {
          onConfirm();
          setAsking(false);
        }}
      >
        {confirmLabel}
      </Button>
      <Button ref={keepRef} type="button" size={size} variant="secondary" onClick={() => setAsking(false)}>
        Keep
      </Button>
    </span>
  );
}
