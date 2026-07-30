import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number, resetKey: string): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // Switching context has to skip the debounce, otherwise the previous
  // document's value stays on screen for a beat. React's documented way to do
  // that is to adjust state while rendering rather than to compare against a
  // ref: https://react.dev/learn/you-might-not-need-an-effect
  //
  // React re-runs this component immediately with the new state, before
  // committing anything, so the caller never observes the stale value.
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setDebouncedValue(value);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}
