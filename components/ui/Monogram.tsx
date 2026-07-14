// Terminal-tag monogram: lowercase "jb" with a block cursor in a rounded
// chip, like a prompt waiting for input. Accent-driven, so film grades
// recolor it. The cursor blink collapses under reduced motion (global CSS).
export default function Monogram({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-[3px] rounded-md border border-accent/45 bg-accent/10 px-2 py-1.5 font-mono text-sm font-bold leading-none text-accent ${className}`}
      role="img"
      aria-label="jb"
    >
      jb
      <span className="cursor-blink inline-block h-[0.9em] w-[0.5em] translate-y-[0.02em] bg-accent" />
    </span>
  );
}
