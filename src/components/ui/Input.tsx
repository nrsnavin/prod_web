import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "./cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id: idProp, ...rest }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink-600">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full h-10 px-3 rounded-lg border bg-white text-sm text-ink-900 placeholder:text-ink-400",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors",
            error ? "border-status-danger" : "border-ink-200",
            className
          )}
          aria-invalid={!!error}
          {...rest}
        />
        {error && <p className="text-xs text-status-danger">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
