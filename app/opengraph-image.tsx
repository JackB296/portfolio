import { ImageResponse } from "next/og";
import { ACCENT, ACCENT_BRIGHT } from "@/lib/theme";

export const runtime = "edge";
export const alt = "Jackson Bialecki · Full Stack Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#05060a",
          backgroundImage: `radial-gradient(900px circle at 80% 10%, rgba(52,211,153,0.18), transparent 55%)`,
          padding: 72,
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* whoami mark, matching components/ui/Whoami.tsx (shown resolved) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            <div style={{ color: "rgba(231,233,243,0.4)", display: "flex" }}>$</div>
            <div style={{ color: "rgba(231,233,243,0.85)", display: "flex" }}>whoami</div>
            <div style={{ color: ACCENT, display: "flex" }}>jackbialecki</div>
            <div style={{ width: 20, height: 36, background: ACCENT, display: "flex" }} />
          </div>
          <div style={{ color: "rgba(231,233,243,0.65)", fontSize: 24 }}>
            Available for co-op: Spring 2027
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#ffffff", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
            Jackson Bialecki
          </div>
          <div style={{ color: ACCENT_BRIGHT, fontSize: 34, marginTop: 8 }}>
            Full Stack Engineer // Web · AI / Machine Learning · Industrial Systems
          </div>
        </div>

        <div style={{ color: "rgba(231,233,243,0.55)", fontSize: 26 }}>
          jbialecki.com
        </div>
      </div>
    ),
    { ...size }
  );
}
