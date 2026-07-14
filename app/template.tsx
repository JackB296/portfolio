"use client";

import { motion, MotionConfig } from "framer-motion";
import { ReactNode } from "react";

// Re-mounts on every route change, giving a soft cross-page fade.
// Important: animate opacity only. A transform here would create a containing
// block that breaks the fixed navbar.
// MotionConfig reducedMotion="user" makes every Framer Motion animation below
// (page fade, Reveal, etc.) honor the OS "Reduce Motion" setting — transforms
// are dropped while gentle opacity fades remain.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
