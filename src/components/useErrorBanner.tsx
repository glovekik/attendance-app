import { useCallback, useRef, useState } from "react";

/**
 * Tiny shared error-popup hook so screens stop swallowing errors into
 * console.log. Returns:
 *   - message: the current error string (null when hidden)
 *   - show:    showing fn — auto-hides after a few seconds
 *   - hide:    dismiss manually
 *
 * Render the popup inline:
 *   {errorMsg && <View style={...}><Text>{errorMsg}</Text></View>}
 *
 * The hook stays UI-agnostic so each screen can style the banner to
 * match its design without dragging in a new dependency.
 */
export function useErrorBanner(autoHideMs: number = 4000) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback(
    (msg: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      timer.current = setTimeout(() => setMessage(null), autoHideMs);
    },
    [autoHideMs]
  );

  return { message, show, hide };
}
