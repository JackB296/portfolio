"use client";

import { MotionConfig } from "framer-motion";
import { ReactNode } from "react";

// Re-mounts on every route change, giving a soft cross-page fade.
// The fade is the .page-fade CSS animation (app/globals.css), not a Framer
// Motion div: a motion `initial={{opacity: 0}}` serializes into the server
// HTML and gates first paint on hydration. CSS starts fading immediately and
// still shows the page with JS disabled.
// Important: animate opacity only. A transform here would create a containing
// block that breaks the fixed navbar.
// MotionConfig reducedMotion="user" makes every Framer Motion animation below
// (Reveal, etc.) honor the OS "Reduce Motion" setting — transforms are
// dropped while gentle opacity fades remain. The CSS fade is collapsed by the
// prefers-reduced-motion block in globals.css.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="page-fade">{children}</div>
    </MotionConfig>
  );
}
