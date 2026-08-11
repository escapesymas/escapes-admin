import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of inactivity. Useful for search inputs that should not trigger a
 * server round-trip on every keystroke.
 *
 * The returned setter reflects the latest typed value immediately so
 * the input stays responsive; the debounced value is what callers should
 * feed into the actual fetch.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
