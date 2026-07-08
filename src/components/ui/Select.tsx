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
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id: idProp, ...rest }, ref) => {
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
            "w-full h-10 px-3 rounded-lg border bg-white text-sm text-ink-900",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500",
            error ? "border-status-danger" : "border-ink-200",
            className
          )}
          aria-invalid={!!error}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-status-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
