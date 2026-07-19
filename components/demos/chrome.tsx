import { ReactNode } from "react";

// Shared presentational chrome for the demos: the rounded canvas frame, the
// pill buttons in the controls row, and the one-line caption underneath.

export function DemoFrame({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-accent/10${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </div>
  );
}

export function DemoButton({
  onClick,
  primary = false,
  className,
  children,
}: {
  onClick: () => void;
  /** Filled accent pill for the primary action; outline pill otherwise. */
  primary?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const base = primary
    ? "rounded-full bg-accent px-5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent-bright"
    : "rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-accent/50 hover:text-white";
  return (
    <button type="button" onClick={onClick} className={className ? `${base} ${className}` : base}>
      {children}
    </button>
  );
}

export function DemoCaption({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-center font-mono text-xs text-white/60">{children}</p>;
}
