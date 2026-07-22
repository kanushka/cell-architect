import { useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number, resetKey: string): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const resetKeyRef = useRef(resetKey);
  const contextChanged = resetKeyRef.current !== resetKey;

  useEffect(() => {
    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      setDebouncedValue(value);
      return;
    }

    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, resetKey, value]);

  return contextChanged ? value : debouncedValue;
}
