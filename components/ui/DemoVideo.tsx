"use client";

// Autoplaying, looping, muted demo clip. React 18 SSR drops the `muted`
// attribute from server HTML, which makes browsers refuse to autoplay until
// hydration; the callback ref re-asserts muted and kicks playback off.
export default function DemoVideo({
  src,
  poster,
  label,
  width,
  height,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <video
      ref={(el) => {
        if (!el) return;
        el.muted = true;
        el.play().catch(() => {});
      }}
      src={src}
      poster={poster}
      aria-label={label}
      width={width}
      height={height}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}
