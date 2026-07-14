import type { ImgHTMLAttributes } from "react";

// A plain <img> with the site's standard lazy-loading defaults. The portfolio
// deliberately avoids next/image (no image-optimization server dependency), so
// this centralizes the one eslint exception and the loading/decoding hints that
// otherwise get copy-pasted at every call site.
export default function Img({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} loading="lazy" decoding="async" {...props} />;
}
