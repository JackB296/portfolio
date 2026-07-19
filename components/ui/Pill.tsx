import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

// The site's pill-shaped call-to-action. Pass `href` for a link — internal
// navigation renders a Next <Link>; downloads and new-tab links render a
// plain <a> — or button props (type, onClick, disabled) for a <button>. The
// variant and size classes are the exact sets the pages used before this
// component existed, so the rendered CSS is unchanged.

const BASE = "rounded-full text-sm font-medium transition-colors";

/** The accent-solid recipe, shared with MagneticButton so the two solid
    pills can't drift apart. */
export const PILL_SOLID_CLASSES = "bg-accent text-ink hover:bg-accent-bright";

const VARIANTS = {
  solid: PILL_SOLID_CLASSES,
  outline:
    "border border-white/15 text-white/85 hover:border-accent/50 hover:text-white",
} as const;

const SIZES = {
  sm: "px-5 py-2.5",
  md: "px-7 py-3.5",
} as const;

type PillStyleProps = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
};

type PillLinkProps = PillStyleProps & { href: string } & Pick<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "download" | "target" | "rel"
  >;

type PillButtonProps = PillStyleProps & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children"
  >;

type PillProps = PillLinkProps | PillButtonProps;

export default function Pill(props: PillProps) {
  const classes = [
    BASE,
    SIZES[props.size ?? "md"],
    VARIANTS[props.variant ?? "solid"],
    props.className,
  ]
    .filter(Boolean)
    .join(" ");

  if (typeof props.href === "string") {
    const { href, download, target, rel, children } = props;
    // Downloads and new-tab links skip client-side routing.
    if (download !== undefined || target) {
      return (
        <a href={href} download={download} target={target} rel={rel} className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  // The destructure omits the style props already consumed by `classes`;
  // what remains are real <button> attributes (type, onClick, disabled, ...).
  const { href, variant, size, className, children, ...buttonProps } = props;
  return (
    <button
      {...buttonProps}
      className={`${classes} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </button>
  );
}
