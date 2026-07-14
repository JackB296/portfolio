import Link from "next/link";
import { ArrowLeftIcon } from "./icons";

// The "back" breadcrumb used at the top of every subpage.
export default function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 font-mono text-sm text-white/55 transition-colors hover:text-accent"
    >
      <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
