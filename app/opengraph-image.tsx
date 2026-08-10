import { ImageResponse } from "next/og";
import { profile } from "@/lib/data";

export const runtime = "edge";
export const alt = "Jackson Bialecki · Full Stack Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card is the hero: the automaton field, the instrument readout, and the
// name in the pixel face. Cells use the site's age ramp (emerald newborn →
// sky → violet → pink) at backdrop opacities so the type stays the subject.
const CELL = 30;
const COLS = Math.ceil(size.width / CELL);
const ROWS = Math.ceil(size.height / CELL);

const AGE_COLORS = [
  "rgba(52, 211, 153, 0.6)", // newborn
  "rgba(56, 189, 248, 0.45)", // young
  "rgba(167, 139, 250, 0.38)", // mature
  "rgba(244, 114, 182, 0.32)", // elder
];

/** Cells stay out of the text bands so the type is never fought for. */
const EXCLUDE: [rowMin: number, rowMax: number, colMin: number, colMax: number][] = [
  [1, 3, 1, 16], // readout left
  [1, 3, 27, 39], // readout right
  [6, 9, 1, 22], // status lines
  [10, 14, 1, 36], // the name
  [17, 19, 1, 10], // domain
];

function excluded(x: number, y: number) {
  return EXCLUDE.some(([r0, r1, c0, c1]) => y >= r0 && y <= r1 && x >= c0 && x <= c1);
}

/** Deterministic LCG so the card renders identically on every request. */
function seededCells() {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const cells: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const r = rand();
      if (r < 0.12 && !excluded(x, y)) {
        const age = rand();
        cells.push({
          x,
          y,
          color:
            age < 0.28
              ? AGE_COLORS[0]
              : age < 0.58
                ? AGE_COLORS[1]
                : age < 0.82
                  ? AGE_COLORS[2]
                  : AGE_COLORS[3],
        });
      }
    }
  }
  return cells;
}

export default async function OG() {
  const pixelFont = await fetch(
    new URL("./fonts/DepartureMono-Regular.woff", import.meta.url)
  ).then((res) => res.arrayBuffer());

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
          padding: 64,
          fontFamily: '"Departure Mono"',
          position: "relative",
        }}
      >
        {/* The automaton field */}
        {seededCells().map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x * CELL + 4,
              top: c.y * CELL + 4,
              width: CELL - 8,
              height: CELL - 8,
              background: c.color,
            }}
          />
        ))}

        {/* Instrument readout */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "rgba(52, 211, 153, 0.75)",
          }}
        >
          <div style={{ display: "flex" }}>conway/life · torus · b3/s23</div>
          <div style={{ display: "flex", color: "#6ee7b7" }}>
            gen 0042 · pop 137
          </div>
        </div>

        {/* Name block, mirroring the hero */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 24,
              lineHeight: 1.7,
              color: "#34d399",
            }}
          >
            <div style={{ display: "flex" }}>
              full stack engineer — cincinnati, oh
            </div>
            <div style={{ display: "flex" }}>
              {profile.status.toLowerCase()}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 18,
              fontSize: 92,
              color: "#ffffff",
            }}
          >
            JACKSON BIALECKI
            <div
              style={{
                width: 40,
                height: 74,
                marginLeft: 14,
                background: "#34d399",
                display: "flex",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "rgba(231,233,243,0.6)" }}>
          jbialecki.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Departure Mono", data: pixelFont, style: "normal", weight: 400 },
      ],
    }
  );
}
