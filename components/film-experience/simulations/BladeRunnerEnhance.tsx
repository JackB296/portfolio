"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";
import {
  BleepsToggle,
  useBladeRunnerBleeps,
} from "@/components/film-experience/simulations/BladeRunnerBleeps";
import {
  ESPER_CASES,
  SCENE_H,
  SCENE_W,
  buildGrainTile,
  drawScene,
} from "@/components/film-experience/simulations/BladeRunnerEsperScene";
import { rankFor } from "@/components/film-experience/simulations/BladeRunnerRank";

// The Esper deck. Three photographs, three questions, and no grid to sweep:
// the operator reads the brief, spends hints that name regions rather than
// coordinates, and walks the frame until the detail resolves out of the grain.
// A print is only accepted when the frame is both pointed at the right thing
// and pushed in far enough to actually read it.

const SCORE_ID = "blade-runner-enhance";
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1.4;
const PAN_STEP = 0.28; // of the visible frame per press
const MARKS = 3;
const CASE_BASE = 20;
const HINT_COST = 3;
const MISS_COST = 4;

type Phase = "running" | "printed" | "done" | "failed";

type Camera = { x: number; y: number; zoom: number };

const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

function EsperDeck() {
  const [caseIndex, setCaseIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("running");
  const [hintsSpent, setHintsSpent] = useState(0);
  const [misses, setMisses] = useState(0);
  const [banked, setBanked] = useState(0);
  const [caseScores, setCaseScores] = useState<readonly number[]>([]);
  const [note, setNote] = useState("");
  const [mag, setMag] = useState(1);
  const reducedMotion = useReducedMotion();
  const { play, muted, toggleMuted } = useBladeRunnerBleeps();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const advanceRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  // Camera state lives in refs: the loop eases the shown camera toward the
  // committed one every frame, and nothing about that should re-render React.
  const targetCam = useRef<Camera>({ x: SCENE_W / 2, y: SCENE_H / 2, zoom: MIN_ZOOM });
  const shownCam = useRef<Camera>({ x: SCENE_W / 2, y: SCENE_H / 2, zoom: MIN_ZOOM });
  const resolveRef = useRef(1);
  const flashRef = useRef<{ kind: "print" | "miss"; until: number } | null>(null);
  const grainRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  // Guards the trailing click of the gesture that revealed a button from
  // falling straight through onto it. The reveal can be driven by either a
  // phase change or a new case, so key the guard on both.
  const { freshPress, markPress } = useFreshPress(`${phase}:${caseIndex}`);

  const current = ESPER_CASES[caseIndex];
  const over = phase === "done" || phase === "failed";
  const live = phase === "running";
  const hintsLeft = current.hints.length - hintsSpent;
  const marksLeft = MARKS - misses;

  useEffect(() => {
    const onDown = () => markPress();
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [markPress]);

  useEffect(() => {
    grainRef.current = buildGrainTile();
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  }, []);
  useEffect(() => {
    if (phase === "printed") window.requestAnimationFrame(() => advanceRef.current?.focus());
    if (over) window.requestAnimationFrame(() => restartRef.current?.focus());
  }, [over, phase]);

  /** Frame geometry for the current canvas size — CSS pixels. */
  const metrics = useCallback(() => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth ?? 640;
    const h = canvas?.clientHeight ?? 360;
    const base = Math.min(w / SCENE_W, h / SCENE_H);
    return { w, h, base };
  }, []);

  /** Hold the visible frame inside the photograph. */
  const clampCam = useCallback(
    (cam: Camera): Camera => {
      const { w, h, base } = metrics();
      const zoom = clamp(cam.zoom, MIN_ZOOM, MAX_ZOOM);
      const scale = base * zoom;
      const vw = w / scale;
      const vh = h / scale;
      const x = vw >= SCENE_W ? SCENE_W / 2 : clamp(cam.x, vw / 2, SCENE_W - vw / 2);
      const y = vh >= SCENE_H ? SCENE_H / 2 : clamp(cam.y, vh / 2, SCENE_H - vh / 2);
      return { x, y, zoom };
    },
    [metrics]
  );

  const commit = useCallback(
    (next: Camera) => {
      targetCam.current = clampCam(next);
      // The readout reports the magnification the operator asked for, which is
      // also the one `print` is judged against — the picture then eases up to
      // it. Reading the eased value instead would make the number disagree
      // with the deck at the exact moment someone commits to a print.
      setMag(Math.round(targetCam.current.zoom * 10) / 10);
      if (reducedMotion) shownCam.current = { ...targetCam.current };
      resolveRef.current = reducedMotion ? 1 : Math.min(resolveRef.current, 0.15);
    },
    [clampCam, reducedMotion]
  );

  const zoomBy = useCallback(
    (factor: number) => {
      if (!live) return;
      const cam = targetCam.current;
      commit({ ...cam, zoom: cam.zoom * factor });
    },
    [commit, live]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (!live) return;
      const { w, h, base } = metrics();
      const cam = targetCam.current;
      const scale = base * cam.zoom;
      commit({ ...cam, x: cam.x + (dx * w * PAN_STEP) / scale, y: cam.y + (dy * h * PAN_STEP) / scale });
    },
    [commit, live, metrics]
  );

  const fitFrame = useCallback(() => {
    if (!live) return;
    commit({ x: SCENE_W / 2, y: SCENE_H / 2, zoom: MIN_ZOOM });
  }, [commit, live]);

  // ---- the deck ----------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const palette = getLiveThemePalette();
    let width = 0;
    let height = 0;
    let dpr = 1;

    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    size();
    const observer = new ResizeObserver(() => {
      size();
      targetCam.current = clampCam(targetCam.current);
    });
    observer.observe(canvas);

    const render = (now: number) => {
      const base = Math.min(width / SCENE_W, height / SCENE_H);
      const cam = shownCam.current;
      const scale = base * cam.zoom;

      // Frame under the photograph, then the photograph itself.
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      context.save();
      context.setTransform(
        scale * dpr,
        0,
        0,
        scale * dpr,
        (width / 2 - cam.x * scale) * dpr,
        (height / 2 - cam.y * scale) * dpr
      );
      context.beginPath();
      context.rect(0, 0, SCENE_W, SCENE_H);
      context.clip();
      drawScene(context, current.shapes, cam.zoom, resolveRef.current, scale);
      context.restore();

      // Overlay lives in CSS pixels.
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Grain, locked to the image so it drifts with the pan, and thinning as
      // the deck pushes in — the picture coming out of the noise.
      const grain = grainRef.current;
      if (grain) {
        // Steep on purpose. Grain that only halves across the whole zoom range
        // adds a flat lift to every pixel and crushes the contrast the detail
        // depends on — at ×10 a black silhouette on a lit doorway measured
        // barely darker than the doorway. The photograph has to genuinely come
        // out of the noise, so the noise has to genuinely go away.
        const amount =
          clamp(0.5 - (cam.zoom - 1) * 0.07, 0.04, 0.5) + (1 - resolveRef.current) * 0.28;
        context.globalAlpha = amount;
        const ox = -((cam.x * scale) % 128);
        const oy = -((cam.y * scale) % 128);
        for (let x = ox - 128; x < width + 128; x += 128) {
          for (let y = oy - 128; y < height + 128; y += 128) {
            context.drawImage(grain, x, y);
          }
        }
        context.globalAlpha = 1;
      }

      // Scanlines, and a vignette that keeps the eye in the middle of the deck.
      context.fillStyle = "rgba(0, 0, 0, 0.16)";
      for (let y = 0; y < height; y += 3) context.fillRect(0, y, width, 1);
      const vignette = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.24,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      // The reticle: corner brackets that close up once the magnification is
      // enough to read a detail, plus a centre cross.
      const cx = width / 2;
      const cy = height / 2;
      // Keyed to the committed camera so the brackets, the readout, and what
      // `print` will accept never disagree while the picture is still easing.
      const ready = targetCam.current.zoom >= current.target.at;
      const box = ready ? Math.min(width, height) * 0.12 : Math.min(width, height) * 0.19;
      const arm = box * 0.42;
      context.strokeStyle = accentAlpha(ready ? 0.92 : 0.5);
      context.lineWidth = ready ? 2 : 1;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const px = cx + sx * box;
        const py = cy + sy * box;
        context.beginPath();
        context.moveTo(px - sx * arm, py);
        context.lineTo(px, py);
        context.lineTo(px, py - sy * arm);
        context.stroke();
      }
      context.strokeStyle = accentAlpha(0.55);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cx - 7, cy);
      context.lineTo(cx + 7, cy);
      context.moveTo(cx, cy - 7);
      context.lineTo(cx, cy + 7);
      context.stroke();

      // Print flash / miss pulse.
      const flash = flashRef.current;
      if (flash && now < flash.until) {
        const p = 1 - (flash.until - now) / 480;
        if (flash.kind === "print") {
          context.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - p)})`;
          context.fillRect(0, 0, width, height);
        } else {
          context.strokeStyle = "rgba(255, 255, 255, " + 0.6 * (1 - p) + ")";
          context.lineWidth = 3;
          context.strokeRect(1.5, 1.5, width - 3, height - 3);
        }
      }
    };

    if (reducedMotion) {
      shownCam.current = { ...targetCam.current };
      resolveRef.current = 1;
      // A static deck that redraws only when the operator moves it: no loop,
      // no drift, and every detail fully resolved at the current magnification.
      let queued = 0;
      const paint = () => {
        queued = 0;
        shownCam.current = { ...targetCam.current };
        resolveRef.current = 1;
        render(performance.now());
      };
      paint();
      const poll = window.setInterval(() => {
        if (!queued) queued = window.requestAnimationFrame(paint);
      }, 120);
      return () => {
        window.clearInterval(poll);
        if (queued) window.cancelAnimationFrame(queued);
        observer.disconnect();
      };
    }

    let frame = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        const t = targetCam.current;
        const s = shownCam.current;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dz = t.zoom - s.zoom;
        s.x += dx * 0.18;
        s.y += dy * 0.18;
        s.zoom += dz * 0.18;
        // How still the deck is, in frame-relative terms — the settle that
        // lets fine detail finish arriving.
        const motion =
          Math.abs(dz) / t.zoom + (Math.abs(dx) + Math.abs(dy)) / (SCENE_W / t.zoom);
        const want = motion < 0.0025 ? 1 : 0;
        resolveRef.current += (want - resolveRef.current) * (want === 1 ? 0.05 : 0.4);
        render(now);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [clampCam, current, phase, reducedMotion]);

  // ---- interaction -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!live) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.14 : 1 / 1.14);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [live, zoomBy]);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!live) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    fieldRef.current?.focus();
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!live || !drag || drag.id !== event.pointerId) return;
    const { base } = metrics();
    const scale = base * targetCam.current.zoom;
    const cam = targetCam.current;
    commit({
      ...cam,
      x: cam.x - (event.clientX - drag.x) / scale,
      y: cam.y - (event.clientY - drag.y) / scale,
    });
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  /** Double-tap pulls the point under the finger toward the reticle and pushes in. */
  const onDoubleClick = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!live) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const { base } = metrics();
    const cam = targetCam.current;
    const scale = base * cam.zoom;
    commit({
      x: cam.x + (event.clientX - bounds.left - bounds.width / 2) / scale,
      y: cam.y + (event.clientY - bounds.top - bounds.height / 2) / scale,
      zoom: cam.zoom * 1.8,
    });
  };

  // ---- case flow ---------------------------------------------------------
  const startCase = useCallback((next: number) => {
    setCaseIndex(next);
    setHintsSpent(0);
    setMisses(0);
    setNote("");
    setPhase("running");
    setMag(MIN_ZOOM);
    targetCam.current = { x: SCENE_W / 2, y: SCENE_H / 2, zoom: MIN_ZOOM };
    shownCam.current = { ...targetCam.current };
    resolveRef.current = 1;
    flashRef.current = null;
  }, []);

  const spendHint = useCallback(() => {
    if (!live || hintsLeft <= 0) return;
    const hint = current.hints[hintsSpent];
    setHintsSpent(hintsSpent + 1);
    setNote(hint.text);
    play("probe");
    if (hint.lock) {
      // The last resort: the deck slews itself to the sector. It costs the
      // whole hint budget, and it still will not read the detail for you.
      commit({
        x: current.target.x,
        y: current.target.y,
        zoom: Math.max(2, current.target.at * 0.5),
      });
    }
  }, [commit, current, hintsLeft, hintsSpent, live, play]);

  const print = useCallback(() => {
    if (!live) return;
    const cam = targetCam.current;
    const { target } = current;
    const distance = Math.hypot(cam.x - target.x, cam.y - target.y);
    const onIt = distance <= target.r;
    const deep = cam.zoom >= target.at;

    if (onIt && deep) {
      const score = Math.max(4, CASE_BASE - hintsSpent * HINT_COST - misses * MISS_COST);
      flashRef.current = { kind: "print", until: performance.now() + 480 };
      play("hit");
      setBanked((total) => total + score);
      setCaseScores((all) => [...all, score]);
      setNote(target.finding);
      setPhase("printed");
      return;
    }

    flashRef.current = { kind: "miss", until: performance.now() + 480 };
    const spent = misses + 1;
    setMisses(spent);
    if (onIt && !deep) {
      play("miss");
      setNote(
        `Grain wins at ×${cam.zoom.toFixed(1)}. Something is under the reticle but it will not separate — push past ×${target.at} and print again.`
      );
    } else if (distance <= target.r * 2.6) {
      play("miss");
      setNote("Close. Whatever the brief wants is near this part of the frame, but not under the reticle.");
    } else {
      play("miss");
      setNote("Nothing but emulsion. That is not what the file is asking for.");
    }
    if (spent >= MARKS) {
      play("lose");
      setPhase("failed");
    }
  }, [current, hintsSpent, live, misses, play]);

  const advance = useCallback(() => {
    if (phase !== "printed" || !freshPress()) return;
    if (caseIndex + 1 < ESPER_CASES.length) {
      startCase(caseIndex + 1);
      return;
    }
    setPhase("done");
    play("win");
    recordSimulationScore(SCORE_ID, banked);
  }, [banked, caseIndex, freshPress, phase, play, startCase]);

  const restart = useCallback(() => {
    setBanked(0);
    setCaseScores([]);
    startCase(0);
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  }, [startCase]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== event.currentTarget) return; // buttons own their keys
    const pans: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const pan = pans[event.key];
    if (pan) {
      event.preventDefault();
      panBy(pan[0], pan[1]);
      return;
    }
    if (event.key === "+" || event.key === "=" || event.key === "PageUp") {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
      return;
    }
    if (event.key === "-" || event.key === "_" || event.key === "PageDown") {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
      return;
    }
    if (event.key === "h" || event.key === "H") {
      event.preventDefault();
      spendHint();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      print();
    }
  };

  const status = useMemo(() => {
    if (phase === "done") return `File closed. ${banked} points across ${ESPER_CASES.length} cases.`;
    if (phase === "failed")
      return `Frame spent on ${current.label}. Three bad prints and the case is cold.`;
    if (phase === "printed") return `Hard copy printed on ${current.label}. ${banked} points banked.`;
    return `Case ${caseIndex + 1} of ${ESPER_CASES.length} · ×${mag.toFixed(1)} magnification · ${marksLeft} print${marksLeft === 1 ? "" : "s"} left · ${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left`;
  }, [banked, caseIndex, current.label, hintsLeft, mag, marksLeft, phase]);

  const rank = rankFor(banked, 48, 28);
  const ready = mag >= current.target.at;

  const panButton = (label: string, dx: number, dy: number, glyph: string) => (
    <button
      type="button"
      onClick={() => panBy(dx, dy)}
      disabled={!live}
      aria-label={label}
      className="border border-accent/30 px-2.5 py-1 text-[11px] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
    >
      {glyph}
    </button>
  );

  return (
    <div
      ref={fieldRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-sim-state={phase}
      data-enhance-case={caseIndex + 1}
      data-enhance-hints={hintsSpent}
      data-enhance-misses={misses}
      data-enhance-score={banked}
      aria-label="Esper deck. Drag or use the arrow keys to pan the photograph, plus and minus to change magnification, Enter to print the frame under the reticle."
      className="flex flex-col gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em]">
        <p className="text-white/45">
          Case {caseIndex + 1}/{ESPER_CASES.length}: <span className="text-accent">{current.label}</span>
        </p>
        <div className="flex items-center gap-3">
          <span className="text-white/60">
            mag <span className="text-accent">×{mag.toFixed(1)}</span>
          </span>
          <span aria-hidden className="tracking-[0.2em] text-white/60">
            {Array.from({ length: MARKS }, (_, i) => (i < marksLeft ? "▮" : "▯")).join("")}
          </span>
          <span className="text-white/45">
            {marksLeft} print{marksLeft === 1 ? "" : "s"}
          </span>
          <BleepsToggle muted={muted} onToggle={toggleMuted} />
        </div>
      </div>

      {over ? (
        <div className="flex flex-col gap-3 border border-accent/30 bg-ink/60 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
            {phase === "done" ? "Case file · closed" : "Case file · cold"}
          </p>
          <ul className="flex flex-col gap-1 text-[11px]">
            {ESPER_CASES.map((item, i) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-1"
              >
                <span className="normal-case text-white/70">{item.label}</span>
                <span className={caseScores[i] === undefined ? "text-white/40" : "text-accent"}>
                  {caseScores[i] === undefined ? "unsolved" : `+${caseScores[i]}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/80">
            Rating: <span className="text-accent">{rank}</span> · {banked} points
          </p>
          <button
            ref={restartRef}
            type="button"
            onClick={restart}
            className="self-start border border-accent/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Pull the frames again
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div
              ref={frameRef}
              className="relative overflow-hidden border border-accent/25 bg-ink/60"
            >
              <canvas
                ref={canvasRef}
                aria-hidden
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={onDoubleClick}
                className="block h-56 w-full cursor-grab touch-none select-none active:cursor-grabbing sm:h-72 lg:h-80"
              />
              <p className="pointer-events-none absolute left-2 top-2 text-[9px] uppercase tracking-[0.16em] text-white/50">
                esper · sector grid live
              </p>
              <p className="pointer-events-none absolute bottom-2 right-2 text-[9px] uppercase tracking-[0.16em]">
                <span className={ready ? "text-accent" : "text-white/45"}>
                  ×{mag.toFixed(1)} · {ready ? "resolution sufficient" : "too coarse to read"}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-3 text-[11px]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-accent">The brief</p>
                <p className="mt-1 normal-case leading-relaxed text-white/80">{current.brief}</p>
              </div>
              {note && (
                <div className="border-l-2 border-accent/50 pl-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                    {phase === "printed" ? "Hard copy" : "Deck note"}
                  </p>
                  <p className="mt-1 normal-case leading-relaxed text-white/75">{note}</p>
                </div>
              )}
              {phase === "printed" && (
                <button
                  ref={advanceRef}
                  type="button"
                  onClick={advance}
                  className="self-start border border-accent/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {caseIndex + 1 < ESPER_CASES.length ? "Next case" : "Close the file"}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {panButton("Pan left", -1, 0, "←")}
              <div className="flex flex-col gap-1">
                {panButton("Pan up", 0, -1, "↑")}
                {panButton("Pan down", 0, 1, "↓")}
              </div>
              {panButton("Pan right", 1, 0, "→")}
            </div>

            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]">
              <button
                type="button"
                onClick={() => zoomBy(ZOOM_STEP)}
                disabled={!live}
                aria-label="Increase magnification"
                className="border border-accent/40 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                enhance +
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1 / ZOOM_STEP)}
                disabled={!live}
                aria-label="Decrease magnification"
                className="border border-accent/30 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                pull back
              </button>
              <button
                type="button"
                onClick={fitFrame}
                disabled={!live}
                aria-label="Fit the whole frame"
                className="border border-accent/30 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                fit frame
              </button>
            </div>

            <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]">
              <button
                type="button"
                onClick={spendHint}
                disabled={!live || hintsLeft <= 0}
                className="border border-accent/30 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Spend a hint ({hintsLeft})
              </button>
              <button
                type="button"
                onClick={print}
                disabled={!live}
                className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Print this frame
              </button>
            </div>
          </div>
        </>
      )}

      <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function BladeRunnerEnhance({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="blade-runner-enhance-title"
      gameId="blade-runner-enhance"
      eyebrow="Esper analysis"
      title="Enhance"
      startLabel="Load the photo"
      stage
      howToPlay={{
        objective:
          "Read each case brief, walk the photograph with pan and magnification until the detail it describes resolves out of the grain, and print that frame.",
        controls: [
          { keys: "drag", does: "pull the photograph under the fixed centre reticle" },
          { keys: "← → ↑ ↓", does: "pan the frame a step at a time" },
          { keys: "+ / −", does: "push in or pull back; the wheel and a double-click do the same" },
          { keys: "H", does: "spend one of three hints — each narrows the region, none give coordinates" },
          { keys: "Enter", does: "print the frame under the reticle" },
        ],
        tip: "A detail only exists past its own magnification: point at the right thing too wide and the grain wins. Three bad prints ends the case; every hint you do not spend is worth points.",
      }}
      reference={{
        quote: "Enhance.",
        scene: "Blade Runner · Deckard walking a photograph with the Esper",
      }}
      onClose={onClose}
    >
      <EsperDeck />
    </SimulationShell>
  );
}
