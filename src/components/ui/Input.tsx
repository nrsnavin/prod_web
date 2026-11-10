import { InputHTMLAttributes, forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { formatDate } from "@/core/format/date";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /**
   * A number field that takes negatives (a stock adjustment). Skips the
   * decimal keypad, which on an iPhone has no minus key.
   */
  allowNegative?: boolean;
  /** Classes for the outer wrapper, e.g. flex sizing when the field sits in a row. */
  wrapperClassName?: string;
}

/** "2026-11-10" → "10 Nov 2026"; "" when the field is empty or not a date. */
function dateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const text = formatDate(`${value}T00:00:00`);
  return text === "—" ? "" : text;
}

/**
 * A date field that reads "10 Nov 2026" at rest.
 *
 * A native date field writes the date in the browser's own order, so on
 * a browser set to US English, Chrome's default, 10 November shows as
 * 11/10/2026, while every printed date in the app reads 10 Nov 2026.
 * The native field is kept (its picker, its keyboard entry, its value)
 * and its text is hidden behind the app's own wording until it has
 * focus; while focused it shows the native editor as before.
 *
 * The label follows the field's real value, however that value gets
 * set: typing, the picker, or a form library writing it directly. The
 * last one fires no event, which is why the element's `value` setter is
 * watched rather than only its change events.
 */
function useDateLabel(enabled: boolean) {
  const elRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const sync = useCallback(() => setText(dateLabel(elRef.current?.value ?? "")), []);

  // After every render: a controlled value or a reset re-renders.
  useLayoutEffect(() => {
    if (enabled) sync();
  });

  // Writes that skip React (react-hook-form's setValue and reset).
  //
  // React itself keeps a `value` property on the element to tell real
  // edits from its own writes. That one is wrapped, never replaced:
  // replacing it would leave React's record stale and its onChange
  // unreliable. When the field unmounts React's property is put back.
  useEffect(() => {
    const el = elRef.current;
    if (!enabled || !el) return;
    const own = Object.getOwnPropertyDescriptor(el, "value");
    const base = own ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (!base?.get || !base.set) return;
    const { get, set } = base;
    Object.defineProperty(el, "value", {
      configurable: true,
      enumerable: base.enumerable,
      get() {
        return get.call(this);
      },
      set(v: string) {
        set.call(this, v);
        sync();
      },
    });
    return () => {
      if (own) Object.defineProperty(el, "value", own);
      else delete (el as { value?: unknown }).value;
    };
  }, [enabled, sync]);

  return { elRef, text, sync };
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, wrapperClassName, id: idProp, allowNegative, onFocus, onBlur, onChange, ...rest }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    const isDate = rest.type === "date";
    const [focused, setFocused] = useState(false);
    const date = useDateLabel(isDate);

    const setRefs = useCallback(
      (el: HTMLInputElement | null) => {
        date.elRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [ref]
    );

    // The message under the field is read out with it — otherwise a
    // screen reader hears "invalid" and never learns why.
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    const covered = isDate && !focused;

    return (
      <div className={cn("space-y-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-600">
            {label}
          </label>
        )}
        <div className={cn(isDate && "relative")}>
          <input
            ref={setRefs}
            id={id}
            className={cn(
              "w-full h-10 px-3 rounded-lg border bg-surface text-sm text-ink-900 placeholder:text-ink-400",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors",
              error ? "border-status-danger" : "border-ink-200",
              covered && "text-transparent",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            // A number field opens the phone's number keypad rather than the
            // full keyboard's top row. `decimal` has digits and a point, so it
            // suits whole numbers too; a field that takes negatives opts out.
            inputMode={rest.type === "number" && !allowNegative ? "decimal" : undefined}
            {...rest}
            // After the spread, so they always run; each passes the event on.
            onFocus={(e) => {
              if (rest.type === "number") e.target.select();
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            onChange={(e) => {
              if (isDate) date.sync();
              onChange?.(e);
            }}
          />
          {covered && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-3 right-10 flex items-center truncate text-sm",
                date.text ? "text-ink-900" : "text-ink-400",
                rest.disabled && "opacity-50"
              )}
            >
              {date.text || "Pick a date"}
            </span>
          )}
        </div>
        {error ? (
          <p id={`${id}-error`} className="text-xs text-status-danger">{error}</p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-ink-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
