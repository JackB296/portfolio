// The recurring page-backdrop glow: a blurred accent disc centered on the
// horizontal midline behind the content. Vertical position (`top-*`, plus
// `-translate-y-1/2` when centered) and geometry (`h-*`, `w-*`, `blur-*`)
// vary per page, so they arrive via className.
export default function Glow({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 -z-10 max-w-full -translate-x-1/2 rounded-full bg-accent/10 ${className}`}
    />
  );
}
