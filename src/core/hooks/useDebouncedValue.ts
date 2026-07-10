import { useEffect, useState } from "react";

// Returns a copy of `value` that only updates after it has stayed
// unchanged for `delayMs` — for debouncing expensive effects (API calls).
export function useDebouncedValue<T>(value: T, delayMs = 500): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
