import { SelectHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "./cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  /**
   * The thing is not in the list: a last option "+ Add a new …" that
   * calls this instead of changing the value. The caller opens the form
   * and sets the value to what it made.
   */
  onCreate?: () => void;
  /** What a new one is called: "+ Add a new expense head". */
  createLabel?: string;
}

/** The value the "+ Add a new …" option carries; never a real value. */
export const CREATE_OPTION = "__create__";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id: idProp, onCreate, createLabel, onChange, ...rest }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-600">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            "w-full h-10 px-3 rounded-lg border bg-surface text-sm text-ink-900",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
            error ? "border-status-danger" : "border-ink-200",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
          onChange={(e) => {
            if (onCreate && e.target.value === CREATE_OPTION) {
              // Put the shown choice back; the form decides what it becomes.
              e.target.value = String(rest.value ?? "");
              onCreate();
              return;
            }
            onChange?.(e);
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {onCreate && <option value={CREATE_OPTION}>+ Add a new {createLabel ?? "one"}…</option>}
        </select>
        {error && <p id={`${id}-error`} className="text-xs text-status-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
