"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  ODYSSEY_BUTTON,
  OdysseyKeyframes,
  OdysseyMuteButton,
  useOdysseyAudio,
} from "@/components/film-experience/simulations/SpaceOdysseyShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// Three-four time, played straight. A sweep hand turns once per measure past
// three beat markers; the pattern says which of them are live, and you nudge
// as the hand crosses one. Hits are judged ON / EARLY / LATE, hits pull the
// ship in toward the port, drift pushes it out. Five approaches, each with a
// different pattern and a tighter tempo.
//
// The waltz is ours: an oom-pah-pah of plain oscillators alternating tonic and
// dominant. No film recording, and a visible mute at all times.
const SCORE_ID = "space-odyssey-docking";

type Approach = Readonly<{
  beatMs: number;
  /** Which of the three beats are live this approach. */
  pattern: readonly [boolean, boolean, boolean];
  /** Alignment needed to complete the approach. */
  target: number;
  name: string;
}>;

const APPROACHES: readonly Approach[] = [
  { beatMs: 920, pattern: [true, false, false], target: 6, name: "on the one" },
  { beatMs: 900, pattern: [true, false, true], target: 8, name: "one and three" },
  { beatMs: 860, pattern: [true, true, true], target: 11, name: "full measure" },
  { beatMs: 790, pattern: [true, false, true], target: 11, name: "quickened" },
  { beatMs: 730, pattern: [true, true, true], target: 14, name: "final turn" },
];

const ON_WINDOW = 95;
const GOOD_WINDOW = 190;
/** Reduced motion: slower turn, far more forgiving judgment. */
const REDUCED_TEMPO = 1.5;
const REDUCED_ON = 210;
const REDUCED_GOOD = 400;
/** Drift at this level and the ship tumbles away. */
const MAX_DRIFT = 6;

type Phase = "aligning" | "paused" | "docked" | "adrift";
type Judgment = "on" | "early" | "late" | "miss";

const JUDGMENT_WORD: Readonly<Record<Judgment, string>> = {
  on: "on the beat",
  early: "early",
  late: "late",
  miss: "missed",
};

/** Score multiplier from the running combo: doubles at 4, triples at 8. */
const comboMultiplier = (combo: number) => (combo >= 8 ? 3 : combo >= 4 ? 2 : 1);

// Tonic and dominant, one per measure: the oom on the downbeat, the pah-pah on
// two and three.
const CHORDS = [
  { bass: 130.81, upper: [329.63, 392.0] },
  { bass: 98.0, upper: [246.94, 293.66] },
] as const;

type Ripple = { at: number; strength: number };

function Waltz() {
  const [phase, setPhase] = useState<Phase>("aligning");
  const [approach, setApproach] = useState(0);
  const [alignment, setAlignment] = useState(0);
  const [drift, setDrift] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [beat, setBeat] = useState(0);
  const [judgment, setJudgment] = useState<{ id: number; kind: Judgment } | null>(null);
  const reducedMotion = useReducedMotion();
  const audio = useOdysseyAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nudgeRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("aligning");
  const approachRef = useRef(0);
  const alignmentRef = useRef(0);
  const driftRef = useRef(0);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const startRef = useRef(0);
  const pausedAtRef = useRef(0);
  const reducedRef = useRef(false);
  /** Cued beats already answered, so a double-tap cannot score twice. */
  const consumedRef = useRef<Set<number>>(new Set());
  const lastSweptRef = useRef(-1);
  /** Next beat index still owed a verdict, so a dropped frame skips nothing. */
  const missCheckRef = useRef(0);
  const ripplesRef = useRef<Ripple[]>([]);
  const shakeUntilRef = useRef(0);
  const hitFlashRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    approachRef.current = approach;
  }, [approach]);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  const spec = APPROACHES[Math.min(approach, APPROACHES.length - 1)];
  const beatMs = spec.beatMs * (reducedMotion ? REDUCED_TEMPO : 1);
  const onWindow = reducedMotion ? REDUCED_ON : ON_WINDOW;
  const goodWindow = reducedMotion ? REDUCED_GOOD : GOOD_WINDOW;

  const armApproach = useCallback((at: number) => {
    consumedRef.current = new Set();
    lastSweptRef.current = -1;
    missCheckRef.current = 0;
    startRef.current = performance.now();
    alignmentRef.current = 0;
    setAlignment(0);
    approachRef.current = at;
    setApproach(at);
  }, []);

  useEffect(() => {
    armApproach(0);
    window.requestAnimationFrame(() => nudgeRef.current?.focus());
  }, [armApproach]);

  const finish = useCallback(
    (ending: "docked" | "adrift") => {
      if (ending === "docked") recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = ending;
      setPhase(ending);
      window.requestAnimationFrame(() => restartRef.current?.focus());
    },
    []
  );

  /** Fold a judgment into alignment, drift, combo, and score. */
  const register = useCallback(
    (kind: Judgment) => {
      setJudgment({ id: performance.now(), kind });
      if (kind === "miss") {
        comboRef.current = 0;
        setCombo(0);
        driftRef.current += 1;
        setDrift(driftRef.current);
        alignmentRef.current = Math.max(0, alignmentRef.current - 1);
        setAlignment(alignmentRef.current);
        shakeUntilRef.current = performance.now() + 300;
        audio.play({ freq: 120, slideTo: 62, duration: 0.22, gain: 0.05, type: "sawtooth" });
        if (driftRef.current >= MAX_DRIFT) finish("adrift");
        return;
      }

      comboRef.current += 1;
      setCombo(comboRef.current);
      driftRef.current = Math.max(0, driftRef.current - 1);
      setDrift(driftRef.current);
      const multiplier = comboMultiplier(comboRef.current);
      scoreRef.current += (kind === "on" ? 100 : 45) * multiplier;
      setScore(scoreRef.current);
      hitFlashRef.current = performance.now() + 220;
      ripplesRef.current.push({ at: performance.now(), strength: kind === "on" ? 1 : 0.55 });
      if (ripplesRef.current.length > 8) ripplesRef.current.shift();
      audio.play({
        freq: kind === "on" ? 784 : 587.33,
        duration: 0.16,
        gain: kind === "on" ? 0.06 : 0.04,
        type: "triangle",
      });

      alignmentRef.current += kind === "on" ? 2 : 1;
      setAlignment(alignmentRef.current);
      const current = APPROACHES[Math.min(approachRef.current, APPROACHES.length - 1)];
      if (alignmentRef.current < current.target) return;

      // Approach complete.
      scoreRef.current += 200 + approachRef.current * 100;
      setScore(scoreRef.current);
      const next = approachRef.current + 1;
      if (next >= APPROACHES.length) {
        audio.play({ freq: 523.25, duration: 0.2, gain: 0.06, type: "triangle" });
        audio.play({ freq: 659.25, duration: 0.2, gain: 0.06, type: "triangle", delay: 0.14 });
        audio.play({ freq: 1046.5, duration: 0.45, gain: 0.06, type: "triangle", delay: 0.28 });
        finish("docked");
        return;
      }
      armApproach(next);
    },
    [armApproach, audio, finish]
  );

  const nudge = useCallback(() => {
    if (phaseRef.current !== "aligning") return;
    audio.unlock();
    const now = performance.now();
    const current = APPROACHES[Math.min(approachRef.current, APPROACHES.length - 1)];
    const period = current.beatMs * (reducedRef.current ? REDUCED_TEMPO : 1);
    const position = (now - startRef.current) / period;
    const nearest = Math.round(position);

    // The closest LIVE beat within one beat either side.
    let best: { index: number; delta: number } | null = null;
    for (const candidate of [nearest - 1, nearest, nearest + 1]) {
      if (candidate < 0) continue;
      const inMeasure = ((candidate % 3) + 3) % 3;
      if (!current.pattern[inMeasure]) continue;
      const delta = (position - candidate) * period;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { index: candidate, delta };
    }

    const width = reducedRef.current ? REDUCED_GOOD : GOOD_WINDOW;
    const tight = reducedRef.current ? REDUCED_ON : ON_WINDOW;
    if (!best || Math.abs(best.delta) > width || consumedRef.current.has(best.index)) {
      register("miss");
      return;
    }
    consumedRef.current.add(best.index);
    register(Math.abs(best.delta) <= tight ? "on" : best.delta < 0 ? "early" : "late");
  }, [audio, register]);

  const restart = useCallback(() => {
    scoreRef.current = 0;
    comboRef.current = 0;
    driftRef.current = 0;
    setScore(0);
    setCombo(0);
    setDrift(0);
    setJudgment(null);
    ripplesRef.current = [];
    phaseRef.current = "aligning";
    setPhase("aligning");
    armApproach(0);
    window.requestAnimationFrame(() => nudgeRef.current?.focus());
  }, [armApproach]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "aligning") {
      pausedAtRef.current = performance.now() - startRef.current;
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      startRef.current = performance.now() - pausedAtRef.current;
      phaseRef.current = "aligning";
      setPhase("aligning");
      window.requestAnimationFrame(() => nudgeRef.current?.focus());
    }
  }, []);

  // The clock: fires the waltz voices, lights the beat pips, and books a miss
  // for any live beat that goes by unanswered.
  useEffect(() => {
    if (phase !== "aligning") return;
    let frame = 0;
    const current = APPROACHES[Math.min(approach, APPROACHES.length - 1)];
    const period = current.beatMs * (reducedRef.current ? REDUCED_TEMPO : 1);
    const width = reducedRef.current ? REDUCED_GOOD : GOOD_WINDOW;

    const tick = () => {
      if (!document.hidden) {
        const now = performance.now();
        const position = (now - startRef.current) / period;
        const index = Math.floor(position);

        if (index !== lastSweptRef.current && index >= 0) {
          lastSweptRef.current = index;
          const inMeasure = ((index % 3) + 3) % 3;
          setBeat(inMeasure);
          const chord = CHORDS[Math.floor(index / 3) % CHORDS.length];
          if (inMeasure === 0) {
            audio.play({ freq: chord.bass, duration: 0.26, gain: 0.055, type: "sine" });
          } else {
            for (const note of chord.upper) {
              audio.play({ freq: note, duration: 0.16, gain: 0.025, type: "triangle" });
            }
          }
        }

        // Every live beat that has slipped fully past its window is a miss.
        // Walking the counter (rather than sampling the current beat) means a
        // dropped frame or a slow paint never lets one through unjudged.
        const cutoff = position - width / period;
        while (missCheckRef.current < cutoff && phaseRef.current === "aligning") {
          const b = missCheckRef.current;
          missCheckRef.current += 1;
          const inMeasure = ((b % 3) + 3) % 3;
          if (!current.pattern[inMeasure]) continue;
          if (consumedRef.current.has(b)) continue;
          consumedRef.current.add(b);
          register("miss");
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, approach, audio, register]);

  // The port. One rAF loop draws the station ring, the beat markers and their
  // windows, the sweep hand, the ship's closing distance, and hit ripples.
  // Reduced motion paints a still frame per beat instead of every frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const size = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    size();

    const angleFor = (beatIndex: number) => -Math.PI / 2 + (beatIndex / 3) * Math.PI * 2;

    const draw = (now: number) => {
      const palette = getLiveThemePalette();
      const current = APPROACHES[Math.min(approachRef.current, APPROACHES.length - 1)];
      const period = current.beatMs * (reducedRef.current ? REDUCED_TEMPO : 1);
      const windowArc = ((reducedRef.current ? REDUCED_GOOD : GOOD_WINDOW) / period / 3) * Math.PI * 2;
      const tightArc = ((reducedRef.current ? REDUCED_ON : ON_WINDOW) / period / 3) * Math.PI * 2;
      const docked = phaseRef.current === "docked";
      const lost = phaseRef.current === "adrift";

      context.clearRect(0, 0, width, height);
      const shaking = !reducedRef.current && now < shakeUntilRef.current;
      context.save();
      if (shaking) {
        const k = (shakeUntilRef.current - now) / 300;
        context.translate((Math.random() - 0.5) * 8 * k, (Math.random() - 0.5) * 8 * k);
      }

      const cx = width / 2;
      const cy = height / 2;
      const ring = Math.min(width, height) * 0.34;

      // Station ring, turning slowly under everything else.
      const spin = reducedRef.current ? 0 : now / 9000;
      context.strokeStyle = accentAlpha(0.28);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cx, cy, ring, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = accentAlpha(0.12);
      context.lineWidth = 1;
      for (let spoke = 0; spoke < 6; spoke += 1) {
        const a = spin + (spoke / 6) * Math.PI * 2;
        context.beginPath();
        context.moveTo(cx + Math.cos(a) * ring * 0.32, cy + Math.sin(a) * ring * 0.32);
        context.lineTo(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring);
        context.stroke();
      }
      context.beginPath();
      context.arc(cx, cy, ring * 0.3, 0, Math.PI * 2);
      context.stroke();

      // Beat markers: live beats get a window arc and a filled cap; dead beats
      // get a bare tick, so the pattern reads without relying on color.
      for (let b = 0; b < 3; b += 1) {
        const a = angleFor(b);
        const live = current.pattern[b];
        if (live) {
          context.strokeStyle = accentAlpha(0.2);
          context.lineWidth = 8;
          context.beginPath();
          context.arc(cx, cy, ring, a - windowArc, a + windowArc);
          context.stroke();
          context.strokeStyle = accentAlpha(0.42);
          context.lineWidth = 8;
          context.beginPath();
          context.arc(cx, cy, ring, a - tightArc, a + tightArc);
          context.stroke();
        }
        const mx = cx + Math.cos(a) * ring;
        const my = cy + Math.sin(a) * ring;
        context.fillStyle = live ? accentAlpha(0.95) : accentAlpha(0.25);
        context.beginPath();
        context.arc(mx, my, live ? (b === 0 ? 6 : 4.5) : 2.5, 0, Math.PI * 2);
        context.fill();
        if (b === 0) {
          // The downbeat carries a ring so it is identifiable by shape.
          context.strokeStyle = accentAlpha(0.7);
          context.lineWidth = 1;
          context.beginPath();
          context.arc(mx, my, 10, 0, Math.PI * 2);
          context.stroke();
        }
      }

      // The sweep hand: one revolution per measure.
      if (!docked && !lost) {
        const position = (now - startRef.current) / period;
        const held = phaseRef.current === "paused" ? pausedAtRef.current / period : position;
        const handAngle = -Math.PI / 2 + (held / 3) * Math.PI * 2;
        context.strokeStyle = palette.bright;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(cx + Math.cos(handAngle) * ring, cy + Math.sin(handAngle) * ring);
        context.stroke();
      }

      // Hit ripples: an expanding ring per clean nudge.
      if (!reducedRef.current) {
        const ripples = ripplesRef.current;
        for (let i = ripples.length - 1; i >= 0; i -= 1) {
          const age = (now - ripples[i].at) / 620;
          if (age >= 1) {
            ripples.splice(i, 1);
            continue;
          }
          context.strokeStyle = accentAlpha((1 - age) * 0.5 * ripples[i].strength);
          context.lineWidth = 2;
          context.beginPath();
          context.arc(cx, cy, ring * (0.3 + age * 0.9), 0, Math.PI * 2);
          context.stroke();
        }
      }

      // The ship: closes on the port as alignment grows, tumbles off on a loss.
      const closeness = docked
        ? 1
        : Math.min(1, alignmentRef.current / current.target);
      const shipRadius = lost ? ring * 2.4 : ring * (2.1 - closeness * 1.75);
      const shipAngle = lost ? Math.PI * 0.35 : Math.PI * 0.28;
      const sx = cx + Math.cos(shipAngle) * shipRadius;
      const sy = cy + Math.sin(shipAngle) * shipRadius;
      context.save();
      context.translate(sx, sy);
      context.rotate(shipAngle + Math.PI);
      context.fillStyle = accentAlpha(lost ? 0.35 : 0.9);
      context.beginPath();
      context.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = accentAlpha(lost ? 0.2 : 0.5);
      context.fillRect(-18, -3, 7, 6);
      context.restore();

      // Approach corridor from ship to port.
      if (!lost) {
        context.strokeStyle = accentAlpha(0.1 + closeness * 0.25);
        context.setLineDash([3, 6]);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(cx, cy);
        context.stroke();
        context.setLineDash([]);
      }

      // Impact flash on a clean hit, and the docked seal.
      if (!reducedRef.current && now < hitFlashRef.current) {
        context.save();
        context.globalAlpha = ((hitFlashRef.current - now) / 220) * 0.22;
        context.fillStyle = palette.bright;
        context.fillRect(0, 0, width, height);
        context.restore();
      }
      if (docked) {
        context.strokeStyle = accentAlpha(0.75);
        context.lineWidth = 2;
        context.beginPath();
        context.arc(cx, cy, ring * 0.62, 0, Math.PI * 2);
        context.stroke();
      }

      context.restore();
    };

    if (reducedMotion) {
      draw(performance.now());
      window.addEventListener("resize", size);
      return () => window.removeEventListener("resize", size);
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) draw(performance.now());
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    window.addEventListener("resize", size);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
    // Reduced motion repaints on each beat and each scored change.
  }, [reducedMotion, phase, beat, alignment, approach]);

  const multiplier = comboMultiplier(combo);

  const status = useMemo(() => {
    if (phase === "docked") return `Docked. ${score} points across five approaches.`;
    if (phase === "adrift") return `The ship tumbled off the corridor with ${score} points.`;
    if (phase === "paused") return "Held. The measure is frozen mid-turn.";
    if (approach === 0 && alignment === 0)
      return "Nudge as the sweep hand crosses a lit marker. Only the lit beats count.";
    return `Approach ${approach + 1} of ${APPROACHES.length}, ${spec.name} — ${alignment}/${spec.target} aligned.`;
  }, [phase, score, approach, alignment, spec]);

  const playing = phase === "aligning" || phase === "paused";

  return (
    <div
      data-sim-state={phase}
      data-docking-approach={approach + 1}
      data-docking-score={score}
      data-docking-combo={combo}
      data-docking-drift={drift}
      data-progress={alignment}
      className="flex flex-col gap-3"
    >
      <OdysseyKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          approach <span className="text-accent">{Math.min(approach + 1, APPROACHES.length)}</span>/
          {APPROACHES.length}
        </span>
        {/* Fixed-width numeric slots: a growing score must not rewrap the HUD
            and shove the play field down mid-measure. */}
        <span>
          score{" "}
          <span
            key={score}
            className={`inline-block min-w-[3.5em] text-accent tabular-nums ${
              reducedMotion ? "" : "so-pop"
            }`}
          >
            {score}
          </span>
        </span>
        <span>
          combo{" "}
          <span className="inline-block min-w-[1.5em] text-accent tabular-nums">{combo}</span>
          <span className="inline-block min-w-[1.8em] text-accent-bright">
            {multiplier > 1 ? `×${multiplier}` : ""}
          </span>
        </span>
        <span aria-label={`drift ${drift} of ${MAX_DRIFT}`}>
          drift{" "}
          <span className={drift >= MAX_DRIFT - 2 ? "text-accent-bright" : "text-accent"}>
            {"▮".repeat(drift)}
            <span className="text-white/20">{"▯".repeat(Math.max(0, MAX_DRIFT - drift))}</span>
          </span>
        </span>
        <span className="ml-auto flex gap-2">
          <OdysseyMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {playing && (
            <button type="button" onClick={togglePause} className={ODYSSEY_BUTTON}>
              {phase === "paused" ? "resume" : "pause"}
            </button>
          )}
        </span>
      </div>

      {/* Play field — the whole port is a tap target. */}
      <div
        className="relative h-52 overflow-hidden border border-accent/25 bg-ink/60 sm:h-72"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          event.preventDefault();
          nudge();
        }}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {judgment && (
          <p
            key={judgment.id}
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 whitespace-nowrap text-[11px] uppercase tracking-[0.22em] ${
              judgment.kind === "on" ? "text-accent-bright" : "text-accent"
            } ${reducedMotion ? "" : "so-float"}`}
          >
            {JUDGMENT_WORD[judgment.kind]}
          </p>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/70">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">paused</p>
          </div>
        )}
      </div>

      {/* Beat pips: shape marks the downbeat, fill marks the live beats. */}
      <div className="flex items-center justify-center gap-3" aria-hidden>
        {[0, 1, 2].map((index) => {
          const live = spec.pattern[index];
          const lit = beat === index && phase === "aligning";
          return (
            <span key={index} className="flex flex-col items-center gap-1">
              <span
                className={`inline-block border ${index === 0 ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} ${
                  live ? "border-accent" : "border-white/20"
                } ${lit ? "bg-accent" : live ? "bg-accent/25" : "bg-transparent"}`}
              />
              <span className="text-[8px] uppercase tracking-[0.16em] text-white/35">
                {index + 1}
                {live ? "" : "·"}
              </span>
            </span>
          );
        })}
      </div>

      {/* Alignment meter */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">alignment</span>
        <div className="h-2 flex-1 overflow-hidden border border-accent/25 bg-white/5" aria-hidden>
          <div
            className="h-full bg-accent/75 transition-[width] duration-200"
            style={{ width: `${Math.min(100, (alignment / spec.target) * 100)}%` }}
          />
        </div>
        <span className="text-[9px] tabular-nums text-white/45">
          {alignment}/{spec.target}
        </span>
      </div>

      {/* Controls sit on their own row: the status line below changes length
          on every judgment, and sharing a row with it would slide the nudge
          target out from under the player's finger mid-measure. */}
      <div className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.12em]">
        <span className="flex gap-2">
          {phase === "aligning" && (
            <button ref={nudgeRef} type="button" onClick={nudge} className={`${ODYSSEY_BUTTON} active:scale-95`}>
              Nudge
            </button>
          )}
          {(phase === "docked" || phase === "adrift") && (
            <button ref={restartRef} type="button" onClick={restart} className={ODYSSEY_BUTTON}>
              Cast off again
            </button>
          )}
        </span>
        <p
          role="status"
          className="min-h-[2.4em] text-[11px] normal-case tracking-normal text-white/70"
        >
          {status}
        </p>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function SpaceOdysseyDocking({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="space-odyssey-docking-title"
      gameId="space-odyssey-docking"
      eyebrow="Orbital rhythm"
      title="Docking waltz"
      startLabel="Begin the approach"
      stage
      reference={{
        scene: "2001: A Space Odyssey (1968) · the station and ship in three-four time",
      }}
      howToPlay={{
        objective:
          "Nudge on the beat until the ship closes on the port, five approaches without drifting away.",
        controls: [
          { keys: "click", does: "nudge — the whole port is the tap target" },
          { keys: "Space", does: "nudge from the focused nudge button" },
          { keys: "pause", does: "freeze the measure mid-turn" },
        ],
        tip: "Only the lit beats count. A nudge off a lit beat, or a lit beat left unanswered, adds drift — six drift and the ship tumbles off.",
      }}
      onClose={onClose}
    >
      <Waltz />
    </SimulationShell>
  );
}
