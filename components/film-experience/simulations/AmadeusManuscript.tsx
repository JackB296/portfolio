"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  AmadeusChip,
  AmadeusKeyframes,
  AmadeusMeter,
  AmadeusMuteButton,
  useAmadeusAudio,
} from "@/components/film-experience/simulations/AmadeusShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useCanvasAutoSize } from "@/lib/useCanvasSize";
import { useFreshPress } from "@/lib/useFreshPress";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Salieri hunts the originals for one crossed-out note, one correction, one
 * sign of struggle. The joke is that there is nothing to find — so the SEARCH
 * is the game, not the finding. You drag a candlelit lens across a manuscript
 * that is only legible under the flame, and every mark you turn up has to be
 * adjudicated: ink blot, wax drip, a copyist's cue — near-misses that look like
 * corrections and are not. The candle burns the whole time, a wrong call costs
 * wax, and the middle page is Salieri's own draft, which IS full of corrections.
 * Reading his scars next to Mozart's clean sheet is where the joke turns.
 */

const SCORE_ID = "amadeus-manuscript";

type MarkKind =
  | "blot"
  | "smudge"
  | "cue"
  | "wax"
  | "print"
  | "split"
  | "struck"
  | "scrape"
  | "insert"
  | "erase";

type Mark = Readonly<{
  id: string;
  /** Normalized position within the page block. */
  x: number;
  y: number;
  kind: MarkKind;
  label: string;
  detail: string;
  /**
   * What the lens actually shows — pure observation, no verdict. This is the
   * evidence the call is made on, and the canvas draws exactly this: if the
   * line says four noteheads are struck through, four noteheads are struck
   * through under the flame.
   */
  look: string;
  /** Why that observation is, or is not, a change to the music. */
  why: string;
  /** True only on Salieri's own draft. */
  correction: boolean;
}>;

type Page = Readonly<{
  id: string;
  hand: "mozart" | "salieri";
  heading: string;
  caption: string;
  /** Lens radius as a fraction of the play area's smaller side. */
  lens: number;
  /** Candle percent burned per second while reading. */
  drain: number;
  marks: readonly Mark[];
}>;

type MarkBody = Readonly<{
  label: string;
  detail: string;
  look: string;
  why: string;
}>;

const clean = (
  id: string,
  x: number,
  y: number,
  kind: MarkKind,
  body: MarkBody
): Mark => ({ id, x, y, kind, ...body, correction: false });

const scar = (
  id: string,
  x: number,
  y: number,
  kind: MarkKind,
  body: MarkBody
): Mark => ({ id, x, y, kind, ...body, correction: true });

/**
 * The rule the whole game turns on, stated once and shown on screen the whole
 * time. Without it a player has no way to know that wax is not a correction.
 */
const RULE =
  "A correction changes the music: a note struck out, scraped away, erased, or added late. Ink, wax, fingerprints, smears and copyist's cues are only the page being handled.";

const PAGES: readonly Page[] = [
  {
    id: "serenade",
    hand: "mozart",
    heading: "Serenade — first sheet",
    caption: "Mozart's hand. The ink is dry and the page has never been opened.",
    lens: 0.3,
    drain: 3.1,
    marks: [
      clean("p1-a", 0.18, 0.24, "blot", {
        label: "an ink blot",
        detail: "A dropped bead of ink. It sits beside the stave, touching nothing.",
        look: "A round bead of dried ink on open paper. The nearest notehead sits clear of it, whole.",
        why: "Ink fell on the sheet. Nothing on the stave was removed or replaced.",
      }),
      clean("p1-b", 0.62, 0.31, "wax", {
        label: "a wax drip",
        detail: "Candle wax, gone hard on the paper. Someone read this by night.",
        look: "Two hardened rings of candle wax over blank paper. No notes underneath them at all.",
        why: "Wax records the hour he worked, not a change of mind.",
      }),
      clean("p1-c", 0.4, 0.68, "cue", {
        label: "a copyist's cue",
        detail: "A catchword for the next sheet. The copyist's hand, not the composer's.",
        look: "A small caret in the margin with the first note of the next sheet written beside it.",
        why: "A catchword tells the copyist where to carry on. The music itself is untouched.",
      }),
      clean("p1-d", 0.82, 0.74, "smudge", {
        label: "a wet-ink smudge",
        detail: "The heel of a hand dragged through a fresh notehead. The note beneath is exact.",
        look: "Ink dragged sideways off a notehead. The ring of the notehead is still unbroken under the smear.",
        why: "A hand passed through wet ink. The pitch under the smear is the pitch he wrote.",
      }),
    ],
  },
  {
    id: "salieri",
    hand: "salieri",
    heading: "Salieri — march of welcome, draft",
    caption: "Your own draft, for comparison. Mark every place you changed your mind.",
    lens: 0.26,
    drain: 3.6,
    marks: [
      scar("p2-a", 0.22, 0.28, "struck", {
        label: "a bar struck through",
        detail: "Four notes crossed out in one stroke. You could not make the bar go anywhere.",
        look: "Two pen strokes run diagonally through four noteheads in a row, cancelling every one of them.",
        why: "The bar was taken out. Four notes you wrote no longer sound — that is a change to the music.",
      }),
      scar("p2-b", 0.55, 0.22, "scrape", {
        label: "a note scraped away",
        detail: "Scraped down to the fibre and written over. Twice.",
        look: "A patch scraped down to the paper fibre, with a fresh notehead written in above it.",
        why: "A note was taken off the page with a knife and another put in its place.",
      }),
      clean("p2-c", 0.34, 0.7, "blot", {
        label: "an ink blot",
        detail: "Only a blot. Not everything on your page is a wound.",
        look: "A bead of ink on open paper, clear of the stave, with the nearest notehead intact.",
        why: "Even on your own page a blot is only a blot. Nothing was rewritten under it.",
      }),
      scar("p2-d", 0.74, 0.63, "insert", {
        label: "a rest inserted late",
        detail: "A rest squeezed in above the line, because the phrase ran long.",
        look: "A caret pushed up under the line, and a rest squeezed into the gap it opens between two noteheads.",
        why: "A rest was added after the bar was finished. The phrase is a beat longer than it was written.",
      }),
      scar("p2-e", 0.86, 0.34, "erase", {
        label: "a note erased and rewritten",
        detail: "One pitch rubbed out and set down again a step lower.",
        look: "A ghost of a notehead rubbed almost away, and the same note redrawn solid a step below it.",
        why: "You wrote one pitch, erased it, and wrote another. The line does not go where it first went.",
      }),
    ],
  },
  {
    id: "originals",
    hand: "mozart",
    heading: "The originals — the whole packet",
    caption: "First and only drafts. Read them until you can say what they are.",
    lens: 0.22,
    drain: 4.3,
    marks: [
      clean("p3-a", 0.14, 0.2, "split", {
        label: "a split-quill hairline",
        detail: "The nib forked and doubled a line. The pitch under it never wavered.",
        look: "Two parallel hairlines run straight through a notehead where the nib forked. The notehead is whole.",
        why: "A worn quill doubled the stroke. The pitch under it never moved.",
      }),
      clean("p3-b", 0.44, 0.26, "print", {
        label: "a fingerprint",
        detail: "A thumb in the margin. Whoever held this was in a hurry, not in doubt.",
        look: "Three arcs of a thumbprint pressed into the margin, well clear of every stave.",
        why: "Someone held the page. Nobody altered it.",
      }),
      clean("p3-c", 0.7, 0.18, "blot", {
        label: "an ink blot",
        detail: "Another blot. Nothing beneath it has been touched.",
        look: "A bead of ink on open paper with no notation beneath it.",
        why: "Another blot, and nothing under it has been changed.",
      }),
      clean("p3-d", 0.26, 0.72, "wax", {
        label: "a wax drip",
        detail: "More wax. He wrote at night and did not stop to fix anything.",
        look: "A ring of wax with a second ring set inside it, over empty paper.",
        why: "He wrote at night and did not stop to fix anything.",
      }),
      clean("p3-e", 0.58, 0.66, "cue", {
        label: "a copyist's cue",
        detail: "A cue mark. Instructions to a scribe, not a second thought.",
        look: "A caret and a catchword at the foot of the margin, in a second, plainer hand.",
        why: "Instructions to a scribe, not a second thought.",
      }),
      clean("p3-f", 0.88, 0.76, "smudge", {
        label: "a smudge",
        detail: "Dragged ink. The note it covers is the note he meant.",
        look: "A drag of ink across a notehead, the ring of the notehead unbroken beneath it.",
        why: "The note it covers is the note he meant.",
      }),
    ],
  },
];

const START_CANDLE = 100;
const WRONG_WAX = 13;
const PAGE_REFILL = 22;
const FOCUS_FACTOR = 0.62;

type Phase = "reading" | "turning" | "paused" | "cleared" | "failed";

/** Deterministic per-mark jitter, so the page looks handmade and never re-rolls. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function ManuscriptScan() {
  const [pageIndex, setPageIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("reading");
  const [judged, setJudged] = useState<Readonly<Record<string, boolean>>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [misreads, setMisreads] = useState(0);
  const [correctionsFound, setCorrectionsFound] = useState(0);
  const [cleanFound, setCleanFound] = useState(0);
  const [note, setNote] = useState<{ id: number; text: string; bad?: boolean } | null>(null);
  const [verdictText, setVerdictText] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useAmadeusAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useCanvasAutoSize(canvasRef);
  const candleBarRef = useRef<HTMLDivElement>(null);
  const candleTextRef = useRef<HTMLSpanElement>(null);
  const dreadBarRef = useRef<HTMLDivElement>(null);
  const dreadTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const candleRef = useRef(START_CANDLE);
  const lensRef = useRef({ x: 0.5, y: 0.5 });
  const focusRef = useRef<string | null>(null);
  const judgedRef = useRef<Record<string, boolean>>({});
  const phaseRef = useRef<Phase>("reading");
  const pageRef = useRef(0);
  const scoreRef = useRef(0);
  const dreadRef = useRef(0);
  const guttersAtRef = useRef(-1);
  const lastRef = useRef(0);
  const drawRef = useRef<(now: number) => void>(() => {});
  const noteIdRef = useRef(0);
  // Reduced motion has no burn loop, so the candle is charged per call instead
  // of per second — the resource still bites, it just isn't a clock.
  const reducedMotionRef = useRef(false);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  // Gesture-identity guard: when a phase change swaps the action button in
  // place, the trailing click of the gesture that caused the change can land on
  // the new button. A real press on the new button begins AFTER the phase did.
  const { freshPress, markPress } = useFreshPress(`${phase}:${pageIndex}`);

  const page = PAGES[pageIndex];
  const marks = page.marks;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    pageRef.current = pageIndex;
  }, [pageIndex]);

  const paintMeters = useCallback(() => {
    const candle = Math.max(0, candleRef.current);
    if (candleBarRef.current) candleBarRef.current.style.width = `${candle.toFixed(1)}%`;
    if (candleTextRef.current) candleTextRef.current.textContent = `${Math.round(candle)}%`;
    const dread = Math.min(100, dreadRef.current);
    if (dreadBarRef.current) dreadBarRef.current.style.width = `${dread.toFixed(1)}%`;
    if (dreadTextRef.current) dreadTextRef.current.textContent = `${Math.round(dread)}%`;
  }, []);

  const endRun = useCallback(
    (outcome: "cleared" | "failed") => {
      if (outcome === "cleared") {
        const bonus = Math.round(candleRef.current * 4);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        noteIdRef.current += 1;
        setNote({ id: noteIdRef.current, text: `candle spared +${bonus}` });
        audio.win();
      } else {
        audio.fail();
      }
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const restart = useCallback(() => {
    candleRef.current = START_CANDLE;
    dreadRef.current = 0;
    scoreRef.current = 0;
    judgedRef.current = {};
    focusRef.current = null;
    lensRef.current = { x: 0.5, y: 0.5 };
    guttersAtRef.current = -1;
    lastRef.current = performance.now();
    paintMeters();
    setJudged({});
    setFocusId(null);
    setScore(0);
    setMisreads(0);
    setCorrectionsFound(0);
    setCleanFound(0);
    setNote(null);
    setVerdictText(null);
    setPageIndex(0);
    phaseRef.current = "reading";
    setPhase("reading");
  }, [paintMeters]);

  useEffect(() => {
    paintMeters();
    lastRef.current = performance.now();
  }, [paintMeters]);

  const spendWax = useCallback(
    (amount: number) => {
      candleRef.current = Math.max(0, candleRef.current - amount);
      paintMeters();
      if (candleRef.current <= 0) {
        endRun("failed");
        return true;
      }
      return false;
    },
    [endRun, paintMeters]
  );

  /** Call the mark currently under the lens. */
  const adjudicate = useCallback(
    (calledCorrection: boolean) => {
      if (phaseRef.current !== "reading") return;
      const id = focusRef.current;
      if (!id) return;
      if (judgedRef.current[id]) return;
      const mark = PAGES[pageRef.current].marks.find((m) => m.id === id);
      if (!mark) return;
      audio.unlock();

      const right = calledCorrection === mark.correction;
      judgedRef.current = { ...judgedRef.current, [id]: right };
      setJudged(judgedRef.current);
      // The call is made, so the flame is holding nothing again and the panel
      // is free to show the verdict instead of the evidence. Under the live
      // flame the loop reaches the same state on its next pass, since it skips
      // judged marks; reduced motion has no loop, so it is done here.
      focusRef.current = null;
      setFocusId(null);
      noteIdRef.current += 1;

      if (right) {
        const gain = 120 + pageRef.current * 40;
        scoreRef.current += gain;
        setScore(scoreRef.current);
        audio.ok();
        setNote({ id: noteIdRef.current, text: `+${gain}` });
        if (mark.correction) {
          setCorrectionsFound((v) => v + 1);
          setVerdictText(`Right — a correction: ${mark.label}. ${mark.why}`);
        } else {
          setCleanFound((v) => v + 1);
          dreadRef.current = Math.min(100, dreadRef.current + 9);
          paintMeters();
          setVerdictText(`Right — not a correction: ${mark.label}. ${mark.why}`);
        }
      } else {
        setMisreads((v) => v + 1);
        audio.wrong();
        guttersAtRef.current = performance.now();
        setNote({ id: noteIdRef.current, text: `−${WRONG_WAX}% candle`, bad: true });
        // A wrong call has to teach: name the mark, restate what was on the
        // page, then say why that does or does not count.
        setVerdictText(
          mark.correction
            ? `Wrong — that WAS a correction: ${mark.label}. ${mark.look} ${mark.why}`
            : `Wrong — that was not a correction: ${mark.label}. ${mark.look} ${mark.why}`
        );
        if (spendWax(WRONG_WAX)) return;
      }

      if (reducedMotionRef.current && spendWax(5)) return;

      const done = PAGES[pageRef.current].marks.every((m) => m.id in judgedRef.current);
      if (!done) return;
      if (pageRef.current + 1 >= PAGES.length) {
        endRun("cleared");
        return;
      }
      audio.clear();
      phaseRef.current = "turning";
      setPhase("turning");
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio, endRun, paintMeters, spendWax]
  );

  const turnPage = useCallback(() => {
    if (phaseRef.current !== "turning") return;
    if (!freshPress()) return;
    candleRef.current = Math.min(START_CANDLE, candleRef.current + PAGE_REFILL);
    paintMeters();
    judgedRef.current = {};
    focusRef.current = null;
    lensRef.current = { x: 0.5, y: 0.5 };
    lastRef.current = performance.now();
    setJudged({});
    setFocusId(null);
    setVerdictText(null);
    noteIdRef.current += 1;
    setNote({ id: noteIdRef.current, text: `fresh candle +${PAGE_REFILL}%` });
    setPageIndex((value) => value + 1);
    phaseRef.current = "reading";
    setPhase("reading");
  }, [freshPress, paintMeters]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "reading") {
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = performance.now();
      phaseRef.current = "reading";
      setPhase("reading");
    }
  }, []);

  /** Move the lens onto the next unadjudicated mark — the keyboard's hands. */
  const nextMark = useCallback(() => {
    if (phaseRef.current !== "reading") return;
    const list = PAGES[pageRef.current].marks.filter((m) => !(m.id in judgedRef.current));
    if (list.length === 0) return;
    const current = focusRef.current;
    const at = list.findIndex((m) => m.id === current);
    const target = list[(at + 1) % list.length];
    lensRef.current = { x: target.x, y: target.y };
    // Set focus here rather than waiting for the loop to notice: reduced
    // motion has no loop, and this move is deliberate either way.
    focusRef.current = target.id;
    setFocusId(target.id);
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (phaseRef.current !== "reading") return;
      lensRef.current = {
        x: Math.min(1, Math.max(0, lensRef.current.x + dx)),
        y: Math.min(1, Math.max(0, lensRef.current.y + dy)),
      };
      if (reducedMotion) drawRef.current(performance.now());
    },
    [reducedMotion]
  );

  // Keyboard: arrows sweep the lens, n finds the next mark, j/k are the call.
  // J and K sit left-to-right under the reading hand in the same order the two
  // call buttons sit on screen: J is "not a correction", K is "a correction".
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 0.02 : 0.06;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          nudge(-step, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          nudge(step, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          nudge(0, -step);
          break;
        case "ArrowDown":
          event.preventDefault();
          nudge(0, step);
          break;
        case "n":
        case "N":
          event.preventDefault();
          nextMark();
          break;
        case "j":
        case "J":
          adjudicate(false);
          break;
        case "k":
        case "K":
          adjudicate(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjudicate, nextMark, nudge]);

  const pointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== "reading") return;
      const rect = event.currentTarget.getBoundingClientRect();
      lensRef.current = {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      };
      if (reducedMotion) drawRef.current(performance.now());
    },
    [reducedMotion]
  );

  // The page itself. One rAF, one palette read per frame, all strokes batched
  // by colour so the lens pass never thrashes fillStyle.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const palette = getLiveThemePalette();
      const active = PAGES[pageRef.current];
      const judgedNow = judgedRef.current;
      const gutter =
        !reducedMotion && guttersAtRef.current > 0 && now - guttersAtRef.current < 420
          ? (Math.random() - 0.5) * 4
          : 0;
      const flame = reducedMotion ? 1 : 0.92 + Math.sin(now / 130) * 0.05;
      const life = candleRef.current / 100;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // The sheet.
      const padX = width * 0.05;
      const padY = height * 0.07;
      const sheetW = width - padX * 2;
      const sheetH = height - padY * 2;
      context.fillStyle = accentAlpha(0.05);
      context.fillRect(padX, padY, sheetW, sheetH);
      context.strokeStyle = accentAlpha(0.16);
      context.lineWidth = 1;
      context.strokeRect(padX + 0.5, padY + 0.5, sheetW - 1, sheetH - 1);

      const px = (nx: number) => padX + nx * sheetW;
      const py = (ny: number) => padY + ny * sheetH;

      /** Staves and noteheads at a given ink strength. */
      const drawScore = (alpha: number, detailed: boolean) => {
        const systems = 4;
        context.lineWidth = 1;
        context.strokeStyle = accentAlpha(0.2 * alpha);
        context.beginPath();
        for (let s = 0; s < systems; s += 1) {
          const top = padY + sheetH * (0.12 + s * 0.23);
          for (let line = 0; line < 5; line += 1) {
            const y = top + line * (sheetH * 0.022);
            context.moveTo(padX + sheetW * 0.05, y);
            context.lineTo(padX + sheetW * 0.95, y);
          }
        }
        context.stroke();

        // Noteheads: fixed contour per system, so the page is written, not noise.
        const contour = [3, 2, 1, 2, 4, 3, 2, 1, 0, 1, 2, 3];
        context.fillStyle = accentAlpha((detailed ? 0.85 : 0.3) * alpha);
        context.strokeStyle = accentAlpha((detailed ? 0.7 : 0.25) * alpha);
        for (let s = 0; s < systems; s += 1) {
          const top = padY + sheetH * (0.12 + s * 0.23);
          const gap = sheetH * 0.022;
          for (let n = 0; n < contour.length; n += 1) {
            const row = contour[(n + s * 3) % contour.length];
            const x = padX + sheetW * (0.09 + (n / contour.length) * 0.84);
            const y = top + row * gap;
            context.beginPath();
            context.ellipse(x, y, gap * 0.62, gap * 0.46, -0.35, 0, Math.PI * 2);
            context.fill();
            if (detailed) {
              context.beginPath();
              context.moveTo(x + gap * 0.6, y);
              context.lineTo(x + gap * 0.6, y - gap * 2.6);
              context.stroke();
            }
          }
        }
      };

      /**
       * One mark, drawn to its kind. Away from the flame every mark is the same
       * anonymous speck; inside the lens it is drawn WITH the notation it sits
       * on, because that is what the call turns on. A struck bar shows the four
       * noteheads it cancels. A smudge shows the notehead surviving underneath
       * it. Nobody should have to guess which of those they are looking at.
       */
      const drawMark = (mark: Mark, alpha: number, detailed: boolean) => {
        const x = px(mark.x) + gutter;
        const y = py(mark.y);
        const r = Math.min(width, height) * 0.034;
        const jitter = hash(mark.id);
        const settled = judgedNow[mark.id];
        const ink = (a: number) => accentAlpha(a * alpha);
        const strong = detailed ? 0.9 : 0.28;
        const solid = detailed ? 0.72 : 0.2;
        context.save();
        context.lineWidth = detailed ? 1.4 : 1;

        /** A filled notehead, optionally stemmed — the music itself. */
        const head = (hx: number, hy: number, a: number, stem = false) => {
          context.fillStyle = ink(a);
          context.beginPath();
          context.ellipse(hx, hy, r * 0.4, r * 0.3, -0.35, 0, Math.PI * 2);
          context.fill();
          if (stem) {
            context.strokeStyle = ink(a);
            context.beginPath();
            context.moveTo(hx + r * 0.38, hy);
            context.lineTo(hx + r * 0.38, hy - r * 1.6);
            context.stroke();
          }
        };
        /** The outline of a notehead, re-struck on top so it reads as intact. */
        const ring = (hx: number, hy: number, a: number) => {
          context.strokeStyle = ink(a);
          context.lineWidth = 1.2;
          context.beginPath();
          context.ellipse(hx, hy, r * 0.42, r * 0.32, -0.35, 0, Math.PI * 2);
          context.stroke();
        };
        /** The margin rule, so "in the margin" is a place and not a claim. */
        const margin = () => {
          context.strokeStyle = ink(0.3);
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x - r * 1.5, y - r * 1.4);
          context.lineTo(x - r * 1.5, y + r * 1.4);
          context.stroke();
        };
        const blob = (a: number) => {
          context.fillStyle = ink(a);
          context.beginPath();
          for (let i = 0; i <= 14; i += 1) {
            const t = (i / 14) * Math.PI * 2;
            const rad = r * (0.5 + Math.sin(t * 3 + jitter * 6) * 0.16);
            const bx = x + Math.cos(t) * rad;
            const by = y + Math.sin(t) * rad;
            if (i === 0) context.moveTo(bx, by);
            else context.lineTo(bx, by);
          }
          context.closePath();
          context.fill();
        };

        switch (mark.kind) {
          case "blot":
            // Ink on open paper, with an untouched note beside it for scale.
            if (detailed) head(x + r * 1.9, y - r * 0.2, solid, true);
            blob(solid);
            break;
          case "wax":
            // Two rings over nothing at all. No notation is drawn here.
            context.strokeStyle = ink(strong);
            context.beginPath();
            context.ellipse(x, y, r * 0.72, r * 0.52, jitter, 0, Math.PI * 2);
            context.stroke();
            context.beginPath();
            context.ellipse(x, y, r * 0.4, r * 0.28, jitter, 0, Math.PI * 2);
            context.stroke();
            break;
          case "smudge":
            // The drag goes over the note; the note's ring survives it.
            if (detailed) head(x, y, solid, true);
            context.fillStyle = ink(detailed ? 0.34 : 0.2);
            context.beginPath();
            context.ellipse(x + r * 0.5, y, r * 1.2, r * 0.34, -0.3, 0, Math.PI * 2);
            context.fill();
            if (detailed) ring(x, y, 0.95);
            break;
          case "cue":
            if (detailed) margin();
            context.strokeStyle = ink(strong);
            context.lineWidth = detailed ? 1.4 : 1;
            context.beginPath();
            context.moveTo(x - r * 0.5, y + r * 0.4);
            context.lineTo(x, y - r * 0.5);
            context.lineTo(x + r * 0.5, y + r * 0.4);
            context.stroke();
            // The catchword: the first note of the next sheet, written small.
            if (detailed) head(x + r * 1.1, y + r * 0.5, solid * 0.8);
            break;
          case "print":
            if (detailed) margin();
            context.strokeStyle = ink(strong);
            for (let i = 1; i <= 3; i += 1) {
              context.beginPath();
              context.arc(x, y, r * 0.22 * i, 0.6, Math.PI * 1.7);
              context.stroke();
            }
            break;
          case "split":
            // Two hairlines straight through a notehead that stays whole.
            if (detailed) head(x, y, solid, true);
            context.strokeStyle = ink(strong);
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(x - r * 1.3, y - 1.5);
            context.lineTo(x + r * 1.3, y - 1.5);
            context.moveTo(x - r * 1.3, y + 1.5);
            context.lineTo(x + r * 1.3, y + 1.5);
            context.stroke();
            if (detailed) ring(x, y, 0.95);
            break;
          case "struck": {
            // Four noteheads, then the two strokes that cancel all four.
            const span = r * 0.95;
            if (detailed) {
              for (let i = 0; i < 4; i += 1) {
                head(x - span * 1.5 + i * span, y + (i % 2 ? r * 0.3 : 0), solid, true);
              }
            }
            context.strokeStyle = ink(strong);
            context.lineWidth = detailed ? 2.2 : 1;
            context.beginPath();
            context.moveTo(x - r * 1.9, y + r * 0.7);
            context.lineTo(x + r * 1.9, y - r * 0.7);
            context.moveTo(x - r * 1.8, y - r * 0.5);
            context.lineTo(x + r * 1.8, y + r * 0.6);
            context.stroke();
            break;
          }
          case "scrape":
            // A ghost note inside a scraped patch, and its replacement above.
            if (detailed) head(x, y + r * 0.1, 0.16);
            context.strokeStyle = ink(strong);
            context.lineWidth = detailed ? 1.4 : 1;
            context.beginPath();
            context.rect(x - r * 0.8, y - r * 0.55, r * 1.6, r * 1.1);
            context.stroke();
            context.lineWidth = 1;
            context.beginPath();
            for (let i = 0; i < 4; i += 1) {
              context.moveTo(x - r * 0.7, y - r * 0.45 + i * r * 0.3);
              context.lineTo(x + r * 0.7, y - r * 0.3 + i * r * 0.3);
            }
            context.stroke();
            if (detailed) head(x + r * 0.15, y - r * 1.5, solid, true);
            break;
          case "insert": {
            // Two notes with a hole opened between them, and a rest in the hole.
            if (detailed) {
              head(x - r * 1.5, y + r * 0.2, solid, true);
              head(x + r * 1.5, y + r * 0.2, solid, true);
            }
            context.strokeStyle = ink(strong);
            context.lineWidth = detailed ? 1.4 : 1;
            context.beginPath();
            context.moveTo(x - r * 0.55, y + r * 1.0);
            context.lineTo(x, y + r * 0.3);
            context.lineTo(x + r * 0.55, y + r * 1.0);
            context.stroke();
            // The rest itself: a bar hung under a short ledger stroke.
            context.fillStyle = ink(strong);
            context.fillRect(x - r * 0.3, y - r * 0.5, r * 0.6, r * 0.26);
            context.beginPath();
            context.moveTo(x - r * 0.45, y - r * 0.5);
            context.lineTo(x + r * 0.45, y - r * 0.5);
            context.stroke();
            break;
          }
          case "erase":
            // The pitch he first wrote, rubbed out, and the one he settled on.
            if (detailed) {
              head(x, y - r * 0.85, 0.18);
              ring(x, y - r * 0.85, 0.24);
            }
            context.strokeStyle = ink(strong);
            context.lineWidth = 1;
            context.beginPath();
            for (let i = 0; i < 3; i += 1) {
              context.moveTo(x - r * 0.6, y - r * 1.2 + i * r * 0.3);
              context.lineTo(x + r * 0.6, y - r * 1.05 + i * r * 0.3);
            }
            context.stroke();
            head(x, y + r * 0.35, solid, true);
            break;
          default:
            break;
        }

        // A settled mark carries its outcome on the page, in shape as well as
        // weight: a ring for a call that held, a ring struck through for one
        // that did not.
        if (settled !== undefined && detailed) {
          context.strokeStyle = accentAlpha(0.8);
          context.lineWidth = 1;
          context.beginPath();
          context.arc(x, y, r * 2.1, 0, Math.PI * 2);
          context.stroke();
          if (!settled) {
            context.beginPath();
            context.moveTo(x - r * 1.5, y - r * 1.5);
            context.lineTo(x + r * 1.5, y + r * 1.5);
            context.stroke();
          }
        }
        context.restore();
      };

      // Pass one: the page as it reads away from the flame — barely at all.
      drawScore(0.5, false);
      for (const mark of active.marks) drawMark(mark, 0.5, false);

      // Pass two: the lens. Everything inside it is legible.
      const lensR = Math.min(width, height) * active.lens * flame;
      const lx = px(lensRef.current.x) + gutter;
      const ly = py(lensRef.current.y);
      context.save();
      context.beginPath();
      context.arc(lx, ly, lensR, 0, Math.PI * 2);
      context.clip();
      const glow = context.createRadialGradient(lx, ly, lensR * 0.1, lx, ly, lensR);
      glow.addColorStop(0, accentAlpha(0.2 * (0.4 + life * 0.6)));
      glow.addColorStop(1, accentAlpha(0.01));
      context.fillStyle = glow;
      context.fillRect(lx - lensR, ly - lensR, lensR * 2, lensR * 2);
      drawScore(1, true);
      for (const mark of active.marks) drawMark(mark, 1, true);
      context.restore();

      // The lens rim, brighter when a mark sits in its middle.
      const focused = focusRef.current;
      context.strokeStyle = accentAlpha(focused ? 0.85 : 0.4);
      context.lineWidth = focused ? 2 : 1.2;
      context.beginPath();
      context.arc(lx, ly, lensR, 0, Math.PI * 2);
      context.stroke();
      if (focused) {
        context.strokeStyle = accentAlpha(0.3);
        context.beginPath();
        context.arc(lx, ly, lensR * (reducedMotion ? 1.1 : 1.08 + Math.sin(now / 220) * 0.05), 0, Math.PI * 2);
        context.stroke();
      }

      // The candle, burning down at the right margin.
      const cx = width - padX * 0.55;
      const baseY = height - padY * 0.5;
      const stickH = sheetH * 0.42 * Math.max(0.08, life);
      context.strokeStyle = accentAlpha(0.35);
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(cx, baseY);
      context.lineTo(cx, baseY - stickH);
      context.stroke();
      const fx = cx + gutter * 0.6;
      const fy = baseY - stickH - 5;
      const fire = context.createRadialGradient(fx, fy, 1, fx, fy, 20 * flame);
      fire.addColorStop(0, accentAlpha(0.9));
      fire.addColorStop(1, accentAlpha(0));
      context.fillStyle = fire;
      context.beginPath();
      context.arc(fx, fy, 20 * flame, 0, Math.PI * 2);
      context.fill();

      // Dread: the room closes in as the clean marks pile up.
      if (dreadRef.current > 0) {
        const vignette = context.createRadialGradient(
          width / 2,
          height / 2,
          Math.min(width, height) * 0.2,
          width / 2,
          height / 2,
          Math.max(width, height) * 0.72
        );
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, `rgba(0,0,0,${(0.15 + (dreadRef.current / 100) * 0.5).toFixed(3)})`);
        context.fillStyle = vignette;
        context.fillRect(0, 0, width, height);
      }
    };
    drawRef.current = draw;

    if (reducedMotion) {
      draw(performance.now());
      return;
    }

    lastRef.current = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const dt = Math.min(0.05, (now - lastRef.current) / 1000);
        lastRef.current = now;
        if (phaseRef.current === "reading") {
          candleRef.current = Math.max(
            0,
            candleRef.current - dt * PAGES[pageRef.current].drain
          );
          paintMeters();
          if (candleRef.current <= 0) endRun("failed");

          // Which mark is under the flame right now.
          const active = PAGES[pageRef.current];
          const lensR = active.lens * FOCUS_FACTOR;
          let found: string | null = null;
          for (const mark of active.marks) {
            if (mark.id in judgedRef.current) continue;
            const dx = mark.x - lensRef.current.x;
            const dy = (mark.y - lensRef.current.y) * 0.6;
            if (Math.hypot(dx, dy) < lensR) {
              found = mark.id;
              break;
            }
          }
          if (found !== focusRef.current) {
            focusRef.current = found;
            setFocusId(found);
            if (found) audio.scratch();
          }
        }
        draw(now);
      } else {
        lastRef.current = now;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [audio, endRun, paintMeters, reducedMotion]);

  // Reduced motion has no loop, so focus resolution and repaint ride the
  // state changes instead.
  useEffect(() => {
    if (!reducedMotion) return;
    drawRef.current(performance.now());
  }, [reducedMotion, phase, pageIndex, judged, focusId]);

  const focusedMark = useMemo(
    () => marks.find((m) => m.id === focusId) ?? null,
    [focusId, marks]
  );

  /** Reduced motion: pick a mark from a list instead of hunting for it. */
  const pickMark = useCallback(
    (mark: Mark) => {
      if (phaseRef.current !== "reading") return;
      lensRef.current = { x: mark.x, y: mark.y };
      focusRef.current = mark.id;
      setFocusId(mark.id);
      drawRef.current(performance.now());
    },
    []
  );

  const remaining = marks.filter((m) => !(m.id in judged)).length;
  const over = phase === "cleared" || phase === "failed";

  const status = useMemo(() => {
    if (phase === "failed")
      return `The candle went out on page ${pageIndex + 1}. ${cleanFound} marks read clean, ${score} points.`;
    if (phase === "cleared")
      return `Not one correction in Mozart's hand. ${correctionsFound} in yours. ${score} points.`;
    if (phase === "paused") return "Held. The candle is shielded.";
    if (phase === "turning")
      return `Page ${pageIndex + 1} read through. ${remaining === 0 ? "Every mark accounted for." : ""} Turn to the next.`;
    // The evidence has to reach a screen reader too, so the live region carries
    // the description rather than announcing that there is one.
    if (focusedMark)
      return `Under the flame: ${focusedMark.look} Call it — J for not a correction, K for a correction.`;
    return `Page ${pageIndex + 1} of ${PAGES.length} — ${marks.length - remaining} of ${marks.length} marks read. Sweep the flame across the sheet.`;
  }, [
    cleanFound,
    correctionsFound,
    focusedMark,
    marks.length,
    pageIndex,
    phase,
    remaining,
    score,
  ]);

  return (
    <div
      data-sim-state={phase}
      data-page={pageIndex + 1}
      data-manuscript-score={score}
      data-marks-read={marks.length - remaining}
      data-misreads={misreads}
      className="flex flex-col gap-3"
    >
      <AmadeusKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          page <span className="text-accent">{pageIndex + 1}</span>/{PAGES.length}
        </span>
        <span>
          score{" "}
          <span key={score} className={reducedMotion ? "text-accent" : "amad-pop text-accent"}>
            {score}
          </span>
        </span>
        <span>
          corrections found{" "}
          <span className="text-accent">
            {page.hand === "mozart" ? "0" : correctionsFound}
          </span>
        </span>
        <span aria-label={`${misreads} misreads`}>
          misread{" "}
          <span aria-hidden className="text-accent">
            {misreads === 0 ? "—" : "✕".repeat(Math.min(misreads, 6))}
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <AmadeusMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(phase === "reading" || phase === "paused") && (
            <AmadeusChip onClick={togglePause}>
              {phase === "paused" ? "resume" : "pause"}
            </AmadeusChip>
          )}
        </span>
      </div>

      <div className="flex gap-4">
        <AmadeusMeter label="candle" barRef={candleBarRef} valueRef={candleTextRef} />
        <AmadeusMeter label="dread" barRef={dreadBarRef} valueRef={dreadTextRef} initial="0%" tone="dim" />
      </div>

      {/* The sheet */}
      <div className="relative">
        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
          {page.heading}
          {page.hand === "salieri" && <span className="text-accent"> · your own hand</span>}
        </p>
        <canvas
          ref={canvasRef}
          aria-hidden
          onPointerDown={(event) => {
            markPress();
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerMove(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 0 && event.pointerType !== "mouse") return;
            pointerMove(event);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          className={`h-56 w-full cursor-crosshair border border-accent/25 bg-ink/60 sm:h-80 ${
            reducedMotion || phase !== "reading" ? "" : "amad-page"
          }`}
          style={{ touchAction: "none" }}
        />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-8 text-center text-[10px] uppercase tracking-[0.2em] ${
              note.bad ? "text-accent" : "text-accent-bright"
            } ${reducedMotion ? "" : "amad-float"}`}
          >
            {note.text}
          </p>
        )}
        {(phase === "paused" || phase === "turning" || over) && (
          <div className="absolute inset-0 top-5 grid place-items-center bg-ink/85 p-4 text-center">
            <div className={reducedMotion ? "" : "amad-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused"
                  ? "paused"
                  : phase === "turning"
                    ? "page read"
                    : phase === "failed"
                      ? "the candle went out"
                      : "no corrections of any kind"}
              </p>
              {phase === "cleared" && (
                <p className="mx-auto mt-3 max-w-md text-[11px] normal-case leading-relaxed text-white/70">
                  Displace one note and there would be diminishment. Displace one
                  phrase and the structure would fall. It was clear to me. These
                  were first and only drafts.
                </p>
              )}
              {over && (
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {score} points · {cleanFound} clean · {correctionsFound} corrections, all yours
                </p>
              )}
              {phase === "turning" && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  candle +{PAGE_REFILL}%
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reduced motion: no flame to sweep — the marks are listed. */}
      {reducedMotion && phase === "reading" && (
        <div className="flex flex-wrap gap-1.5">
          {marks.map((mark, index) => {
            const settled = mark.id in judged;
            return (
              <button
                key={mark.id}
                type="button"
                onClick={() => pickMark(mark)}
                disabled={settled}
                aria-label={`Inspect mark ${index + 1}${settled ? ", already called" : ""}`}
                className={`border px-2 py-1 text-[10px] uppercase tracking-[0.12em] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  focusId === mark.id
                    ? "border-accent bg-accent/15 text-accent-bright"
                    : "border-accent/30 text-white/60 hover:bg-accent/10"
                }`}
              >
                mark {index + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* The call. Under the flame the panel reads out what is physically on
          the page — never what it is called — so the judgement is the player's
          and is made on evidence they can also see in the lens. */}
      <div
        data-mark-kind={focusedMark && phase === "reading" ? focusedMark.kind : ""}
        className="min-h-[4.5rem] border border-accent/20 bg-ink/50 p-2"
      >
        {focusedMark && phase === "reading" ? (
          <div className={reducedMotion ? "" : "amad-rise"} key={focusedMark.id}>
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/40">
              under the flame
            </p>
            <p className="mt-1 text-[11px] normal-case leading-relaxed text-accent">
              {focusedMark.look}
            </p>
            <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/50">
              Did the music change here? J — not a correction. K — a correction.
            </p>
          </div>
        ) : (
          <p className="text-[11px] normal-case leading-relaxed text-white/50">
            {verdictText ?? "Nothing under the flame. Keep sweeping."}
          </p>
        )}
      </div>

      <p className="border-l-2 border-accent/40 pl-2 text-[10px] normal-case leading-relaxed text-white/45">
        {RULE}
      </p>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/65">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "turning" ? (
          <AmadeusChip
            innerRef={actionRef}
            onClick={turnPage}
            onPointerDown={markPress}
            bright
          >
            Turn the page
          </AmadeusChip>
        ) : over ? (
          <AmadeusChip innerRef={actionRef} onClick={restart} bright>
            {phase === "cleared" ? "Read them again" : "Light another candle"}
          </AmadeusChip>
        ) : (
          <>
            {/* The accessible names are pinned with aria-label so the visible
                key hint can sit inside the button without renaming it. */}
            <button
              type="button"
              onClick={() => adjudicate(false)}
              disabled={!focusedMark || phase !== "reading"}
              aria-label="Not a correction"
              aria-keyshortcuts="j"
              className="amad-press border border-accent/30 px-4 py-2 text-[11px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              Not a correction{" "}
              <span aria-hidden className="ml-1 border border-accent/40 px-1 text-accent">
                J
              </span>
            </button>
            <button
              type="button"
              onClick={() => adjudicate(true)}
              disabled={!focusedMark || phase !== "reading"}
              aria-label="A correction"
              aria-keyshortcuts="k"
              className="amad-press border border-accent/30 px-4 py-2 text-[11px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
            >
              A correction{" "}
              <span aria-hidden className="ml-1 border border-accent/40 px-1 text-accent">
                K
              </span>
            </button>
            <AmadeusChip onClick={nextMark} disabled={phase !== "reading"} label="Move the flame to the next mark">
              next mark · n
            </AmadeusChip>
            <span className="text-white/35">arrows sweep · j / k call</span>
          </>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function AmadeusManuscript({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="amadeus-manuscript-title"
      gameId="amadeus-manuscript"
      eyebrow="Manuscript review"
      title="The flawless page"
      startLabel="Read the originals"
      stage
      howToPlay={{
        objective:
          "Sweep the candle across each page and call every mark it turns up before the wax runs out. A correction is a change to the MUSIC — a note struck out, scraped away, erased, or added late. Ink, wax, fingerprints, smears and copyist's cues are only the page being handled.",
        controls: [
          { keys: "← → ↑ ↓", does: "sweep the flame across the page" },
          { keys: "Shift + arrows", does: "sweep in finer steps" },
          { keys: "N", does: "move the flame to the next mark" },
          { keys: "J", does: "call the mark under the flame NOT a correction" },
          { keys: "K", does: "call it a correction" },
        ],
        tip: "The panel under the page describes exactly what the lens is showing, and the lens draws the notation the mark sits on — a struck bar shows the noteheads it cancels, a smudge shows the notehead surviving under it. Read the description, then call it. A wrong call costs wax and tells you what the mark actually was. You can also drag the flame with a pointer; with reduced motion there is no sweep at all — the marks are listed as buttons to inspect one at a time.",
      }}
      reference={{
        quote: "No corrections of any kind.",
        scene: "Amadeus (1984) · Salieri reading the originals, waiting for a crossed-out note",
      }}
      onClose={onClose}
    >
      <ManuscriptScan />
    </SimulationShell>
  );
}
