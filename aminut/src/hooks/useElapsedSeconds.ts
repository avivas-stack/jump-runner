import { useEffect, useRef, useState } from "react";

/**
 * Counts whole seconds since `active` last became true, resetting to 0 whenever it turns
 * false (and staying 0 until the next time it turns true). Used to give the user a visible
 * sign of progress during a long-running request — a OCR/vision call with nothing else on
 * screen can otherwise look stalled even when it's working normally.
 */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    setSeconds(0);
    const interval = setInterval(() => {
      if (startRef.current !== null) {
        setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  return seconds;
}
