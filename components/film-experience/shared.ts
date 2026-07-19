import type {
  FilmFrame,
  FilmVisualInstance,
  FilmVisualModule,
} from "@/lib/filmExperienceTypes";

export const hash = (index: number, seed = 1) => {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export const wrap = (value: number, maximum: number) =>
  ((value % maximum) + maximum) % maximum;

export const withAlpha = (rgb: string, alpha: number) =>
  rgb.startsWith("rgb(") ? rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`) : rgb;

/** A stateless film world: one draw function, no per-activation state. */
export const makeFilmVisual = (
  draw: (frame: FilmFrame) => void
): FilmVisualModule => ({ create: () => ({ draw }) });

/**
 * A stateful film world: the factory runs once per activation, so cached
 * bitmaps, freeze-frame machines, and other working state live in the
 * instance closure and are released when CinematicLayer disposes it.
 */
export const makeStatefulFilmVisual = (
  create: () => FilmVisualInstance
): FilmVisualModule => ({ create });

export function drawFilmLabel(
  frame: FilmFrame,
  text: string,
  x: number,
  y: number,
  alpha = 0.35,
  align: CanvasTextAlign = "left"
) {
  const { context } = frame;
  context.save();
  context.fillStyle = withAlpha(frame.accentBright, alpha);
  context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.textAlign = align;
  context.letterSpacing = "1px";
  context.fillText(text, x, y);
  context.restore();
}

const HERO_LABEL = "JACKSON'S PORTFOLIO SITE";
const SECTION_REFRESH_MS = 1_500;

/**
 * Tracks the page section under the reader's eye. Each film activation
 * creates its own tracker inside its create() closure, so the measurement
 * cache lives per instance and is released with it — no module-level state.
 * Index 0 is the hero; sections are re-measured periodically so layout
 * shifts (fonts, images) do not strand stale offsets.
 */
export function createSectionTracker() {
  let measuredAt = -Infinity;
  let sections: ReadonlyArray<{ top: number; label: string }> = [];

  return {
    sectionAt(scroll: number): { label: string; index: number } {
      if (typeof document === "undefined") return { label: HERO_LABEL, index: 0 };
      const now = performance.now();
      if (now - measuredAt > SECTION_REFRESH_MS) {
        measuredAt = now;
        sections = Array.from(
          document.querySelectorAll<HTMLElement>("section[id]")
        )
          // The hero (#top) is the "Chapter I" landing state, not its own section.
          .filter((element) => element.id !== "top")
          .map((element) => ({
            top: element.getBoundingClientRect().top + window.scrollY,
            label: element.id.replace(/-/g, " ").toUpperCase(),
          }))
          .sort((a, b) => a.top - b.top);
      }

      const anchor = scroll + window.innerHeight * 0.4;
      let index = 0;
      let label = HERO_LABEL;
      sections.forEach((section, sectionIndex) => {
        if (anchor >= section.top) {
          index = sectionIndex + 1;
          label = section.label;
        }
      });
      return { label, index };
    },
  };
}

/* --- music analysis tap --------------------------------------------------
   The AudioDirector registers an AnalyserNode wired to the active film's
   music bus; canvas modes read band levels from it so visuals can follow the
   actual recording. With sound off (or no analyser) this returns silence. */
let musicAnalyser: AnalyserNode | null = null;
let analyserBins: Uint8Array<ArrayBuffer> | null = null;

export function setMusicAnalyser(node: AnalyserNode | null) {
  musicAnalyser = node;
  analyserBins = null;
}

export function musicLevels(bandCount: number): number[] {
  const levels = new Array<number>(bandCount).fill(0);
  if (!musicAnalyser) return levels;
  if (!analyserBins || analyserBins.length !== musicAnalyser.frequencyBinCount) {
    analyserBins = new Uint8Array(musicAnalyser.frequencyBinCount);
  }
  musicAnalyser.getByteFrequencyData(analyserBins);
  const bins = analyserBins.length;
  for (let band = 0; band < bandCount; band += 1) {
    // Logarithmic bin ranges: low bands read few bins, high bands read many,
    // which roughly matches how a keyboard divides pitch.
    const start = Math.floor(Math.pow(bins, band / bandCount));
    const end = Math.min(
      bins,
      Math.max(start + 1, Math.floor(Math.pow(bins, (band + 1) / bandCount)))
    );
    let sum = 0;
    for (let bin = start; bin < end; bin += 1) sum += analyserBins[bin];
    levels[band] = sum / (Math.max(1, end - start) * 255);
  }
  return levels;
}

export function drawSoftVignette(frame: FilmFrame, alpha = 0.12) {
  const { context, width, height } = frame;
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.1,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, withAlpha(frame.accentDim, alpha));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}
