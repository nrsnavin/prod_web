import { cn } from "./cn";

export interface FilterChipsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// Horizontal filter chip row (Zomato-style list filters).
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors",
            value === o.value
              ? "bg-brand-50 border-brand-500 text-brand-600"
              : "bg-white border-ink-200 text-ink-600 hover:border-ink-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
