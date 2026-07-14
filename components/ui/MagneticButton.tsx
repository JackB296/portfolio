"use client";

import { useRef, ReactNode, MouseEvent } from "react";
import { motion } from "framer-motion";

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  variant?: "solid" | "ghost";
  external?: boolean;
};

export default function MagneticButton({
  children,
  href,
  onClick,
  className = "",
  variant = "solid",
  external = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0px, 0px)";
  };

  const base =
    "group relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium tracking-wide transition-colors duration-300";
  const styles =
    variant === "solid"
      ? "bg-accent text-ink hover:bg-accent-bright"
      : "border border-white/15 text-white/90 hover:border-accent/60 hover:text-white";

  const inner = (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)" }}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="inline-block"
      >
        {inner}
      </a>
    );
  }

  return (
    <button onClick={onClick} className="inline-block">
      {inner}
    </button>
  );
}
