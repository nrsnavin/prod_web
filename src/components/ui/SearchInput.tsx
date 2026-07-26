import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "./cn";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Debounce in ms before onChange fires (0 = immediate) */
  delay?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  delay = 300,
}: SearchInputProps) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), delay);
    return () => clearTimeout(t);
  }, [text, value, onChange, delay]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-10 pl-9 pr-8 rounded-lg border border-ink-200 bg-white text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
      />
      {text && (
        <button
          onClick={() => {
            setText("");
            onChange("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-900"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
