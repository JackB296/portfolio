"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Guards against the release of a press that *caused* a phase change being
 * counted as a fresh interaction with the new phase. Several simulations swap
 * an action button in place when a round resolves, so the pointer-up that
 * triggered the swap must not immediately re-fire against the replacement.
 *
 * Usage: either spread `rootProps` on the game's root (capture phase, so every
 * press is timestamped even when a child stops propagation) or call `markPress`
 * from your own pointer-down-capture handler. Gate terminal actions on
 * `freshPress()` — true only when the press began after the current phase did.
 *
 * @param phaseKey any value that changes whenever the phase changes; the moment
 *   it changes is recorded synchronously (layout effect) so it is never later
 *   than a press that arrives in the same frame.
 */
export function useFreshPress(phaseKey: unknown) {
  const phaseChangedAtRef = useRef(0);
  const lastPressAtRef = useRef(0);

  // Stamped synchronously, before the browser dispatches the trailing click.
  useLayoutEffect(() => {
    phaseChangedAtRef.current = performance.now();
  }, [phaseKey]);

  const markPress = useCallback(() => {
    lastPressAtRef.current = performance.now();
  }, []);

  const freshPress = useCallback(
    () => lastPressAtRef.current > phaseChangedAtRef.current,
    []
  );

  return { freshPress, markPress, rootProps: { onPointerDownCapture: markPress } };
}
