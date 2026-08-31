const isDev = process.env.NODE_ENV !== "production";

// 'unsafe-eval' is added in dev only — Next.js Fast Refresh (react-refresh) needs
// it for HMR; production builds do not, so it stays out of the deployed policy.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDev ? "'unsafe-eval'" : "",
  "https://va.vercel-scripts.com",
]
  .filter(Boolean)
  .join(" ");

// Non-CSP security headers shared by every route.
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// Strict CSP for the Next.js app. 'unsafe-inline' stays for the inline JSON-LD and
// styled-jsx; tighten to a nonce later if desired. Vercel Analytics loads from
// va.vercel-scripts.com. No blob:/worker: here — the app doesn't need them.
const appCsp = {
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    // The film simulations front each game with the official YouTube player for
    // the scene they allude to. Privacy-enhanced (nocookie) host only, and only
    // frames — no YouTube script, style, or image origins are opened up.
    "frame-src 'self' https://www.youtube-nocookie.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

// Looser CSP scoped to the embedded p5.js game only. p5.sound (Tone.js) spins up
// Web Workers / AudioWorklets from blob: URLs, so script-src/worker-src must allow
// blob:. Kept off the rest of the site so the relaxation is contained to this game.
const gameCsp = {
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' blob:",
    "font-src 'self' data:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; "),
};

// Large static media (film-mode audio, the vendored p5 game). Not immutable —
// tracks are swapped in place at stable URLs — so bound staleness at a day and
// let stale-while-revalidate hide the refresh. Without this, Vercel serves
// public/ with max-age=0 and every film commit re-downloads its audio.
const mediaCache = {
  key: "Cache-Control",
  value: "public, max-age=86400, stale-while-revalidate=604800",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  async headers() {
    return [
      // Game assets get the blob-friendly CSP.
      { source: "/neat-flappy/:path*", headers: [...baseHeaders, gameCsp, mediaCache] },
      // Everything except the game gets the strict CSP (negative lookahead so
      // only one CSP header is ever emitted per path).
      { source: "/((?!neat-flappy/).*)", headers: [...baseHeaders, appCsp] },
      // Later matches win per header key, so this only adds the cache policy.
      { source: "/audio/:path*", headers: [mediaCache] },
    ];
  },
};

export default nextConfig;
