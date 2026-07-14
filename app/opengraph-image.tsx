import { ImageResponse } from "next/og";
import { ACCENT, ACCENT_BRIGHT, accentAlpha } from "@/lib/theme";

export const runtime = "edge";
export const alt = "Jackson Bialecki — Full Stack Engineer";
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
          backgroundImage: `radial-gradient(900px circle at 80% 10%, ${accentAlpha(0.25)}, transparent 55%)`,
          padding: 72,
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              border: `1px solid ${accentAlpha(0.5)}`,
              background: accentAlpha(0.12),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ACCENT,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            JB
          </div>
          <div
            style={{
              color: "#34d399",
              fontSize: 22,
              border: "1px solid rgba(52,211,153,0.3)",
              background: "rgba(52,211,153,0.1)",
              padding: "8px 18px",
              borderRadius: 999,
            }}
          >
            Available for co-op — Spring 2027
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#ffffff", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
            Jackson Bialecki
          </div>
          <div style={{ color: ACCENT_BRIGHT, fontSize: 34, marginTop: 8 }}>
            Full Stack Engineer // Web · AI/ML · Industrial Systems
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
