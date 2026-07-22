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
  WallEChip,
  WallEKeyframes,
  WallEMuteButton,
  WallEReadout,
  useWallEAudio,
} from "@/components/film-experience/simulations/WallEShared";
import {
  BIN_LABEL,
  SHIFTS,
  type Bin,
  type Glyph,
  type SalvageItem,
} from "@/components/film-experience/simulations/WallESortData";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { useFreshPress } from "@/lib/useFreshPress";

// Salvage rides a real belt past two bins — KEEP the curiosities, CRUSH the
// rubble — and the binary holds right up until a spork arrives and belongs to
// neither. That object opens a third bin permanently, and the belt spends the
// rest of the shift testing whether the new category was a fluke.
//
// Three shifts, each faster than the last. Sorting inside the reach bracket
// scores more than a panicked early grab; letting something ride off the end
// costs directive. Run the directive meter to zero and the belt jams.

const SCORE_ID = "wall-e-spork";
const HEAD = 0.66; // where the sorting arm sits, in belt fraction
const REACH_IN = 0.5;
const REACH_OUT = 0.84;
const GAP = 0.19; // spacing between items on the belt
const MAX_DIRECTIVE = 100;
const MAX_PARTICLES = 90;

type Phase = "sorting" | "spork" | "paused" | "shift" | "jammed" | "done";
type Riding = SalvageItem & { x: number; id: number };
type Fling = { glyph: Glyph; x: number; y: number; bin: Bin; start: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number };

const binY: Readonly<Record<Bin, number>> = { keep: 0.2, curio: 0.5, crush: 0.82 };

/** Item shapes so the belt reads as objects, not as a text label. */
function drawGlyph(
  context: CanvasRenderingContext2D,
  glyph: Glyph,
  x: number,
  y: number,
  size: number
) {
  context.beginPath();
  switch (glyph) {
    case "disc":
      context.arc(x, y, size * 0.5, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(x, y, size * 0.18, 0, Math.PI * 2);
      context.stroke();
      break;
    case "shard":
      context.moveTo(x - size * 0.5, y + size * 0.45);
      context.lineTo(x - size * 0.1, y - size * 0.5);
      context.lineTo(x + size * 0.2, y + size * 0.1);
      context.lineTo(x + size * 0.5, y + size * 0.45);
      context.closePath();
      context.stroke();
      break;
    case "block":
      context.rect(x - size * 0.42, y - size * 0.42, size * 0.84, size * 0.84);
      context.stroke();
      break;
    case "cube":
      context.rect(x - size * 0.42, y - size * 0.42, size * 0.84, size * 0.84);
      context.stroke();
      context.beginPath();
      context.moveTo(x - size * 0.42, y - size * 0.06);
      context.lineTo(x + size * 0.42, y - size * 0.06);
      context.moveTo(x - size * 0.06, y - size * 0.42);
      context.lineTo(x - size * 0.06, y + size * 0.42);
      context.stroke();
      break;
    case "coil":
      for (let i = 0; i < 3; i += 1) {
        context.beginPath();
        context.arc(x - size * 0.2 + i * size * 0.2, y, size * 0.24, 0, Math.PI * 2);
        context.stroke();
      }
      break;
    case "bulb":
      context.arc(x, y - size * 0.12, size * 0.34, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.rect(x - size * 0.14, y + size * 0.2, size * 0.28, size * 0.24);
      context.stroke();
      break;
    case "ring":
      context.arc(x, y, size * 0.3, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.rect(x - size * 0.42, y - size * 0.42, size * 0.84, size * 0.84);
      context.stroke();
      break;
    case "spork":
      // A handle that ends in tines AND a bowl: the object that will not sort.
      context.moveTo(x - size * 0.45, y + size * 0.3);
      context.lineTo(x + size * 0.1, y - size * 0.1);
      context.stroke();
      context.beginPath();
      context.arc(x + size * 0.24, y - size * 0.24, size * 0.22, Math.PI * 0.6, Math.PI * 2.1);
      context.stroke();
      for (let i = -1; i <= 1; i += 1) {
        context.beginPath();
        context.moveTo(x + size * 0.16 + i * size * 0.1, y - size * 0.3);
        context.lineTo(x + size * 0.22 + i * size * 0.14, y - size * 0.52);
        context.stroke();
      }
      break;
  }
}

function SortStream() {
  const [phase, setPhase] = useState<Phase>("sorting");
  const [shift, setShift] = useState(0);
  const [sorted, setSorted] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bins, setBins] = useState(2);
  const [note, setNote] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const [shakeAt, setShakeAt] = useState(0);
  const reducedMotion = useReducedMotion();
  const audio = useWallEAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bayRef = useRef<HTMLDivElement>(null);
  const directiveBarRef = useRef<HTMLDivElement>(null);
  const directiveTextRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  const phaseRef = useRef<Phase>("sorting");
  const shiftRef = useRef(0);
  const queueRef = useRef<Riding[]>([]);
  const pendingRef = useRef<readonly SalvageItem[]>([]);
  const directiveRef = useRef(MAX_DIRECTIVE);
  const streakRef = useRef(0);
  const scoreRef = useRef(0);
  const sortedRef = useRef(0);
  const binsRef = useRef(2);
  // Set once a curiosity has actually been filed in the third bin: after that,
  // pretending the binary still covers everything has a price.
  const curioLearnedRef = useRef(false);
  const lastRef = useRef(0);
  const idRef = useRef(0);
  const flingsRef = useRef<Fling[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const armRef = useRef(0); // 0..1 arm swing, decays after a sort
  const drawRef = useRef<(now: number) => void>(() => {});
  const reducedRef = useRef(false);
  // Hazard (a): when a phase resolves and swaps the action button in place, the
  // trailing click of the causing gesture can land on the new button. Reject by
  // gesture identity — a real press begins after the phase changed.
  const { freshPress, markPress } = useFreshPress(phase);

  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const paintDirective = useCallback(() => {
    const fraction = Math.max(0, directiveRef.current) / MAX_DIRECTIVE;
    if (directiveBarRef.current) {
      directiveBarRef.current.style.width = `${(fraction * 100).toFixed(1)}%`;
    }
    if (directiveTextRef.current) {
      directiveTextRef.current.textContent = `${Math.round(fraction * 100)}%`;
    }
  }, []);

  const spawnParticles = useCallback(
    (nx: number, ny: number, count: number) => {
      if (reducedRef.current) return;
      const particles = particlesRef.current;
      for (let i = 0; i < count; i += 1) {
        if (particles.length >= MAX_PARTICLES) break;
        particles.push({
          x: nx,
          y: ny,
          vx: (Math.random() - 0.5) * 3,
          vy: -0.5 - Math.random() * 2.4,
          life: 1,
        });
      }
    },
    []
  );

  /** Lay out a shift: the first items already spaced along the belt. */
  const loadShift = useCallback(
    (index: number) => {
      const items = SHIFTS[index].items;
      const riding: Riding[] = [];
      const visible = Math.min(3, items.length);
      for (let i = 0; i < visible; i += 1) {
        idRef.current += 1;
        riding.push({
          ...items[i],
          id: idRef.current,
          x: reducedRef.current ? HEAD - i * GAP : 0.4 - i * GAP,
        });
      }
      queueRef.current = riding;
      pendingRef.current = items.slice(visible);
      shiftRef.current = index;
      setShift(index);
      lastRef.current = 0;
      phaseRef.current = "sorting";
      setPhase("sorting");
    },
    []
  );

  const restart = useCallback(() => {
    directiveRef.current = MAX_DIRECTIVE;
    streakRef.current = 0;
    scoreRef.current = 0;
    sortedRef.current = 0;
    binsRef.current = 2;
    curioLearnedRef.current = false;
    flingsRef.current = [];
    particlesRef.current = [];
    setStreak(0);
    setScore(0);
    setSorted(0);
    setBins(2);
    setNote(null);
    paintDirective();
    loadShift(0);
  }, [loadShift, paintDirective]);

  useEffect(() => {
    restart();
    // Restart identity is stable; this arms the first shift on mount.
  }, [restart]);

  const endRun = useCallback(
    (outcome: "jammed" | "done") => {
      if (outcome === "done") audio.win();
      else audio.fail();
      audio.stopDrone();
      if (scoreRef.current > 0) recordSimulationScore(SCORE_ID, scoreRef.current);
      phaseRef.current = outcome;
      setPhase(outcome);
      window.requestAnimationFrame(() => actionRef.current?.focus());
    },
    [audio]
  );

  const bleed = useCallback(
    (amount: number) => {
      directiveRef.current -= amount;
      paintDirective();
      if (directiveRef.current <= 0) {
        directiveRef.current = 0;
        paintDirective();
        endRun("jammed");
        return true;
      }
      return false;
    },
    [endRun, paintDirective]
  );

  /** Push the next queued object onto the head of the belt. */
  const feed = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending.length) return;
    idRef.current += 1;
    const tail = queueRef.current.length
      ? Math.min(...queueRef.current.map((item) => item.x))
      : HEAD;
    queueRef.current.push({
      ...pending[0],
      id: idRef.current,
      // The still belt keeps its exact spacing so the next object lands under
      // the arm; the moving one feeds from off the left edge.
      x: reducedRef.current ? tail - GAP : Math.min(-0.05, tail - GAP),
    });
    pendingRef.current = pending.slice(1);
  }, []);

  /** The frontmost object — the one under the arm. */
  const front = useCallback(() => {
    const queue = queueRef.current;
    if (!queue.length) return null;
    return queue.reduce((best, item) => (item.x > best.x ? item : best), queue[0]);
  }, []);

  /**
   * The spork beat. The moment an object that fits neither bin reaches the arm,
   * the third bin exists — and it never goes away again. Called after every
   * change to the head of the belt rather than from a watcher loop.
   */
  const syncCurio = useCallback(() => {
    const item = front();
    const isCurio = item?.bin === "curio";
    if (isCurio && binsRef.current < 3) {
      binsRef.current = 3;
      setBins(3);
      audio.tone({ freq: 300, slideTo: 900, type: "triangle", duration: 0.35, gain: 0.5 });
    }
    if (isCurio && phaseRef.current === "sorting") {
      phaseRef.current = "spork";
      setPhase("spork");
    } else if (!isCurio && phaseRef.current === "spork") {
      phaseRef.current = "sorting";
      setPhase("sorting");
    }
  }, [audio, front]);

  const clearShift = useCallback(() => {
    const bonus = 200 * (shiftRef.current + 1) + Math.round(directiveRef.current * 4);
    scoreRef.current += bonus;
    setScore(scoreRef.current);
    setNote({ id: performance.now(), text: `shift clear +${bonus}`, good: true });
    audio.clear();
    if (shiftRef.current + 1 >= SHIFTS.length) {
      endRun("done");
      return;
    }
    phaseRef.current = "shift";
    setPhase("shift");
    window.requestAnimationFrame(() => actionRef.current?.focus());
  }, [audio, endRun]);

  /** Remove the frontmost object and settle the consequences. */
  const consume = useCallback(
    (item: Riding, bin: Bin) => {
      queueRef.current = queueRef.current.filter((riding) => riding.id !== item.id);
      // The still belt advances one slot per decision, so the next object
      // always arrives under the arm instead of stranding half a field back.
      if (reducedRef.current) {
        for (const riding of queueRef.current) riding.x += GAP;
      }
      const canvas = canvasRef.current;
      flingsRef.current.push({
        glyph: item.glyph,
        x: item.x,
        y: 0.52,
        bin,
        start: performance.now(),
      });
      if (bin === "crush") {
        spawnParticles(
          (canvas?.offsetWidth ?? 320) * 0.86,
          (canvas?.offsetHeight ?? 200) * binY.crush,
          12
        );
      }
      sortedRef.current += 1;
      setSorted(sortedRef.current);
      armRef.current = 1;
      if (!queueRef.current.length && !pendingRef.current.length) {
        clearShift();
        return;
      }
      if (queueRef.current.length < 3) feed();
      syncCurio();
    },
    [clearShift, feed, spawnParticles, syncCurio]
  );

  const sort = useCallback(
    (bin: Bin) => {
      const running = phaseRef.current === "sorting" || phaseRef.current === "spork";
      if (!running) return;
      audio.unlock();
      const item = front();
      if (!item) return;

      // The rule-break: an object that is a fork AND a spoon refuses both
      // halves of the binary, always — it bounces and the belt does not
      // advance. Discovering that is free; once the third bin has been used,
      // forcing a curiosity into the old taxonomy costs directive.
      if (item.bin === "curio" && bin !== "curio") {
        audio.wrong();
        setShakeAt(performance.now());
        setNote({
          id: performance.now(),
          text: curioLearnedRef.current
            ? `it is not ${BIN_LABEL[bin]} — you know that now`
            : `${BIN_LABEL[bin]} won't take it`,
          good: false,
        });
        if (curioLearnedRef.current) bleed(8);
        return;
      }

      const exact = bin === item.bin;
      const defensible = !exact && item.also === bin;
      const precise = item.x >= REACH_IN && item.x <= REACH_OUT;

      if (exact || defensible) {
        streakRef.current += exact ? 1 : 0;
        const multiplier = 1 + Math.min(3, Math.floor(streakRef.current / 4));
        const base = item.bin === "curio" ? 200 : 100;
        const gained = Math.round(
          base * (exact ? 1 : 0.4) * multiplier * (precise ? 1.5 : 1)
        );
        scoreRef.current += gained;
        directiveRef.current = Math.min(MAX_DIRECTIVE, directiveRef.current + (exact ? 6 : 2));
        paintDirective();
        setScore(scoreRef.current);
        setStreak(streakRef.current);
        setNote({
          id: performance.now(),
          text: defensible
            ? `either way — +${gained}`
            : precise
              ? `clean reach +${gained}`
              : `+${gained}`,
          good: true,
        });
        if (item.bin === "curio" && bin === "curio") curioLearnedRef.current = true;
        if (exact) audio.ok();
        else audio.chirp(streakRef.current);
        consume(item, bin);
        return;
      }

      // Wrong bin.
      streakRef.current = 0;
      setStreak(0);
      audio.wrong();
      setShakeAt(performance.now());
      setNote({
        id: performance.now(),
        text: `${item.label} isn't ${BIN_LABEL[bin]}`,
        good: false,
      });
      if (bleed(14)) return;
      consume(item, bin);
    },
    [audio, bleed, consume, front, paintDirective]
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === "sorting" || phaseRef.current === "spork") {
      audio.stopDrone();
      phaseRef.current = "paused";
      setPhase("paused");
    } else if (phaseRef.current === "paused") {
      lastRef.current = 0;
      phaseRef.current = "sorting";
      setPhase("sorting");
    }
  }, [audio]);

  // Keyboard mirrors the bins so the belt is playable without tabbing between
  // three buttons under time pressure.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        sort("crush");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        sort("keep");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (binsRef.current >= 3) sort("curio");
      } else if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sort, togglePause]);

  /** One simulation step. Reduced motion never calls this — its belt is still. */
  const tick = useCallback(
    (dt: number) => {
      const speed = SHIFTS[shiftRef.current].speed;
      let missed = false;
      const survivors: Riding[] = [];
      for (const item of queueRef.current) {
        item.x += speed * dt;
        if (item.x > 1.04) {
          missed = true;
          continue;
        }
        survivors.push(item);
      }
      queueRef.current = survivors;
      if (missed) {
        streakRef.current = 0;
        setStreak(0);
        audio.wrong();
        setNote({ id: performance.now(), text: "rode off the end", good: false });
        sortedRef.current += 1;
        setSorted(sortedRef.current);
        if (bleed(18)) return;
        if (!queueRef.current.length && !pendingRef.current.length) {
          clearShift();
          return;
        }
        if (queueRef.current.length < 3) feed();
        syncCurio();
      }
      // Keep the belt fed as the leader advances.
      const tail = queueRef.current.length
        ? Math.min(...queueRef.current.map((item) => item.x))
        : 1;
      if (pendingRef.current.length && tail > -0.02 && queueRef.current.length < 4) feed();
      armRef.current = Math.max(0, armRef.current - dt * 2.4);
    },
    [audio, bleed, clearShift, feed, syncCurio]
  );

  // A newly loaded shift could in principle open on a curiosity.
  useEffect(() => {
    syncCurio();
  }, [shift, syncCurio]);

  // Impact shake on a rejected or wrong bin. Restarted imperatively — keying
  // the element would remount the canvas and orphan its 2D context.
  useEffect(() => {
    if (!shakeAt || reducedMotion) return;
    const node = bayRef.current;
    if (!node) return;
    node.classList.remove("walle-shake");
    void node.offsetWidth; // force a reflow so the animation replays
    node.classList.add("walle-shake");
  }, [shakeAt, reducedMotion]);

  // The bay: belt, chevrons, the three chutes, the objects, and the arm.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = (now: number) => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      // One palette read per frame, then batched strokes.
      const palette = getLiveThemePalette();
      const beltY = height * 0.52;
      const size = Math.min(36, width * 0.078, height * 0.16);
      const reduced = reducedRef.current;

      context.fillStyle = palette.inkSoft;
      context.fillRect(0, 0, width, height);

      // Dust haze drifting across the bay.
      if (!reduced) {
        context.fillStyle = accentAlpha(0.05);
        for (let i = 0; i < 22; i += 1) {
          const dx = ((i * 137 + now / 26) % (width + 40)) - 20;
          const dy = (i * 71) % height;
          context.fillRect(dx, dy, 2, 1);
        }
      }

      // The belt: two rails and moving chevrons that show its speed.
      context.strokeStyle = accentAlpha(0.32);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, beltY + size * 0.7);
      context.lineTo(width * 0.9, beltY + size * 0.7);
      context.moveTo(0, beltY + size * 0.7 + 7);
      context.lineTo(width * 0.9, beltY + size * 0.7 + 7);
      context.stroke();
      const scroll = reduced ? 0 : (now / 1000) * SHIFTS[shiftRef.current].speed * width;
      context.strokeStyle = accentAlpha(0.16);
      context.beginPath();
      for (let i = -1; i < 26; i += 1) {
        const cx = ((i * 26 + scroll) % (width * 0.9 + 26)) - 13;
        context.moveTo(cx, beltY + size * 0.7);
        context.lineTo(cx + 6, beltY + size * 0.7 + 7);
      }
      context.stroke();

      // The reach bracket: sorting inside it is worth more. Drawn as corner
      // ticks rather than a slab so it frames the object without hiding it.
      const braTop = beltY - size * 0.85;
      const braBot = beltY + size * 0.7;
      context.fillStyle = accentAlpha(0.028);
      context.fillRect(
        width * REACH_IN,
        braTop,
        width * (REACH_OUT - REACH_IN),
        braBot - braTop
      );
      context.strokeStyle = accentAlpha(0.4);
      context.beginPath();
      for (const edge of [REACH_IN, REACH_OUT]) {
        const ex = width * edge;
        const inward = edge === REACH_IN ? 9 : -9;
        context.moveTo(ex, braTop + 12);
        context.lineTo(ex, braTop);
        context.lineTo(ex + inward, braTop);
        context.moveTo(ex, braBot - 12);
        context.lineTo(ex, braBot);
        context.lineTo(ex + inward, braBot);
      }
      context.stroke();

      // Where the belt runs out: the crusher's teeth. Anything that reaches
      // them was never sorted, and the directive meter pays for it.
      context.strokeStyle = accentAlpha(0.3);
      context.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const tx = width * 0.9 - 2 + i * 3;
        context.moveTo(tx, beltY + size * 0.7 + 9);
        context.lineTo(tx + 1.5, beltY + size * 0.7 + 15);
      }
      context.stroke();

      // The three chutes down the right edge. CURIOS stays a ghost until an
      // object earns it.
      context.font = "9px monospace";
      const chutes: Bin[] = ["keep", "curio", "crush"];
      for (const bin of chutes) {
        const locked = bin === "curio" && binsRef.current < 3;
        const y = height * binY[bin];
        context.strokeStyle = accentAlpha(locked ? 0.12 : 0.45);
        context.beginPath();
        context.moveTo(width * 0.9, y - 13);
        context.lineTo(width - 6, y - 13);
        context.lineTo(width - 6, y + 13);
        context.lineTo(width * 0.9, y + 13);
        context.stroke();
        context.fillStyle = accentAlpha(locked ? 0.16 : 0.75);
        context.fillText(BIN_LABEL[bin], width * 0.905, y + 3);
      }

      // Objects riding the belt. The frontmost is drawn bright; the lookahead
      // dims with distance so the queue reads as depth.
      const lead = queueRef.current.length
        ? queueRef.current.reduce((best, item) => (item.x > best.x ? item : best))
        : null;
      for (const item of queueRef.current) {
        const x = item.x * width * 0.9;
        if (x < -size || x > width) continue;
        const leading = lead?.id === item.id;
        const bob = reduced || !leading ? 0 : Math.sin(now / 220) * 1.5;
        context.strokeStyle = leading ? palette.bright : accentAlpha(0.34);
        context.lineWidth = leading ? 2 : 1;
        drawGlyph(context, item.glyph, x, beltY + bob, size);
      }
      context.lineWidth = 1;

      // The sorting arm above the head, dipping after each sort.
      const armX = width * 0.9 * HEAD;
      const dip = armRef.current * size * 0.5;
      context.strokeStyle = accentAlpha(0.6);
      context.beginPath();
      context.moveTo(armX, 6);
      context.lineTo(armX, beltY - size * 0.8 + dip);
      context.moveTo(armX - 7, beltY - size * 0.8 + dip);
      context.lineTo(armX + 7, beltY - size * 0.8 + dip);
      context.stroke();

      // Flung objects arcing into their chute.
      const flings = flingsRef.current;
      for (let i = flings.length - 1; i >= 0; i -= 1) {
        const fling = flings[i];
        const t = reduced ? 1 : Math.max(0, (now - fling.start) / 420);
        if (t >= 1) {
          flings.splice(i, 1);
          continue;
        }
        const fromX = fling.x * width * 0.9;
        const toX = width * 0.93;
        const toY = height * binY[fling.bin];
        const fx = fromX + (toX - fromX) * t;
        const fy = beltY + (toY - beltY) * t - Math.sin(t * Math.PI) * height * 0.12;
        context.strokeStyle = accentAlpha(0.8 * (1 - t));
        drawGlyph(context, fling.glyph, fx, fy, size * (1 - t * 0.35));
      }

      // Crush spray.
      if (!reduced) {
        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.12;
          p.life -= 0.026;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          context.fillStyle = accentAlpha(p.life * 0.7);
          context.fillRect(p.x, p.y, 2, 2);
        }
      }

      // Directive strain: the frame darkens as the meter falls.
      const strain = 1 - Math.max(0, directiveRef.current) / MAX_DIRECTIVE;
      if (strain > 0.01) {
        context.fillStyle = accentAlpha(strain * 0.16);
        context.fillRect(0, 0, width, height);
      }
    };
    drawRef.current = draw;

    if (reducedMotion) {
      draw(performance.now());
      return;
    }

    let frame = 0;
    const loop = (now: number) => {
      if (!document.hidden) {
        const last = lastRef.current || now;
        const dt = Math.min(0.05, (now - last) / 1000);
        lastRef.current = now;
        if (phaseRef.current === "sorting" || phaseRef.current === "spork") tick(dt);
        draw(now);
      } else {
        lastRef.current = 0;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, tick]);

  // Reduced motion repaints on state change instead of running a loop.
  useEffect(() => {
    if (reducedMotion) drawRef.current(performance.now());
  }, [reducedMotion, phase, sorted, bins, shift]);

  // A low belt hum while the shift runs.
  useEffect(() => {
    if (phase !== "sorting" && phase !== "spork") return;
    if (audio.muted || reducedMotion) return;
    audio.startDrone(38 + shift * 6, "sawtooth");
    return () => audio.stopDrone();
  }, [audio, phase, reducedMotion, shift]);

  const running = phase === "sorting" || phase === "spork";
  const leadLabel = running ? (front()?.label ?? "belt clear") : "";
  const total = SHIFTS.reduce((sum, entry) => sum + entry.items.length, 0);

  const status = useMemo(() => {
    if (phase === "jammed")
      return `The belt jammed on shift ${shift + 1}. ${sorted} filed, ${score} points.`;
    if (phase === "done")
      return `All three shifts run. ${sorted} objects filed, ${score} points — and a bin that didn't exist this morning.`;
    if (phase === "shift") return `Shift ${shift + 1} clear. ${score} points so far.`;
    if (phase === "paused") return "Belt held.";
    if (phase === "spork")
      return bins < 3
        ? "This one is a fork. And a spoon. Neither bin will take it."
        : "Curiosity on the belt — it needs the third bin.";
    return bins < 3
      ? "Keep the curiosities, crush the rubble. Sort inside the bracket for more."
      : "Three bins now. Some things are neither.";
  }, [bins, phase, score, shift, sorted]);

  return (
    <div
      data-sim-state={phase}
      data-spork-shift={shift + 1}
      data-spork-sorted={sorted}
      data-spork-score={score}
      data-spork-streak={streak}
      data-spork-bins={bins}
      className="flex flex-col gap-3"
      onPointerDownCapture={markPress}
    >
      <WallEKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          shift <span className="text-accent">{shift + 1}</span>/{SHIFTS.length}
        </span>
        <WallEReadout label="filed" value={`${sorted}/${total}`} reducedMotion={reducedMotion} />
        <WallEReadout label="score" value={score} reducedMotion={reducedMotion} />
        <WallEReadout label="streak" value={`x${1 + Math.min(3, Math.floor(streak / 4))}`} reducedMotion={reducedMotion} />
        <span className="flex items-center gap-1.5">
          directive <span ref={directiveTextRef} className="text-accent">100%</span>
        </span>
        <span className="ml-auto flex gap-2">
          <WallEMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
          {(running || phase === "paused") && (
            <WallEChip onClick={togglePause}>{phase === "paused" ? "resume" : "pause"}</WallEChip>
          )}
        </span>
      </div>

      {/* Directive meter */}
      <div className="h-1.5 w-full bg-white/10" aria-hidden>
        <div ref={directiveBarRef} className="h-full bg-accent/80" style={{ width: "100%" }} />
      </div>

      {/* The bay */}
      <div ref={bayRef} className="relative" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-56 w-full border border-accent/25 bg-ink/60 sm:h-72"
        />
        {note && (
          <p
            key={note.id}
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-3 text-center text-[10px] uppercase tracking-[0.2em] ${
              note.good ? "text-accent-bright" : "text-white/70"
            } ${reducedMotion ? "" : "walle-float"}`}
          >
            {note.text}
          </p>
        )}
        {running && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] normal-case tracking-[0.04em] text-white/80">
            {leadLabel}
          </p>
        )}
        {(phase === "paused" || phase === "shift" || phase === "jammed" || phase === "done") && (
          <div className="absolute inset-0 grid place-items-center bg-ink/75 px-4 text-center">
            <div className={reducedMotion ? "" : "walle-rise"}>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/70">
                {phase === "paused"
                  ? "belt held"
                  : phase === "shift"
                    ? `shift ${shift + 1} clear`
                    : phase === "jammed"
                      ? "the belt jammed"
                      : "day's end"}
              </p>
              {phase !== "paused" && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-accent">
                  {score} points · {sorted} filed
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p role="status" className="min-h-[2.25rem] text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        {running || phase === "paused" ? (
          <>
            <button
              type="button"
              onClick={() => sort("crush")}
              className="walle-press border border-accent/30 px-4 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ← Crush
            </button>
            <button
              type="button"
              onClick={() => sort("keep")}
              className="walle-press border border-accent/30 px-4 py-2 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Keep →
            </button>
            {bins >= 3 && (
              <button
                type="button"
                onClick={() => sort("curio")}
                className={`walle-press border border-accent/60 px-4 py-2 text-accent-bright hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  phase === "spork" && !reducedMotion ? "walle-throb" : ""
                }`}
              >
                ↓ Set aside
              </button>
            )}
            <span className="text-white/35">
              {reducedMotion
                ? "each choice advances the belt one object"
                : "← → sort · ↓ set aside · P holds the belt"}
            </span>
          </>
        ) : phase === "shift" ? (
          <WallEChip
            innerRef={actionRef}
            bright
            onClick={() => {
              if (freshPress()) loadShift(shift + 1);
            }}
          >
            Run shift {shift + 2} — {SHIFTS[Math.min(shift + 1, SHIFTS.length - 1)].label}
          </WallEChip>
        ) : (
          <WallEChip
            innerRef={actionRef}
            bright
            onClick={() => {
              if (freshPress()) restart();
            }}
          >
            {phase === "done" ? "Run the belt again" : "Clear the jam"}
          </WallEChip>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function WallESortSpork({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="wall-e-spork-title"
      gameId="wall-e-spork"
      eyebrow="Salvage sort"
      title="Sort the spork"
      startLabel="Open the stream"
      stage
      howToPlay={{
        objective:
          "File everything riding the belt into the right bin across three shifts without draining the directive meter.",
        controls: [
          { keys: "←", does: "crush it" },
          { keys: "→", does: "keep it" },
          { keys: "↓", does: "the third bin — once there is a third bin" },
          { keys: "P", does: "hold the belt" },
        ],
        tip: "Sorting inside the reach bracket scores more than a panicked early grab, and anything that rides off the end costs directive. Two bins hold the whole job right up until they do not.",
      }}
      reference={{
        scene: "WALL·E (2008) · fork? spoon? …spork — the object that breaks taxonomy",
      }}
      onClose={onClose}
    >
      <SortStream />
    </SimulationShell>
  );
}
