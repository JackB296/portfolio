"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  ODYSSEY_BUTTON,
  OdysseyKeyframes,
  OdysseyMuteButton,
} from "@/components/film-experience/simulations/SpaceOdysseyShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { isVoiceMuted, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";

// A standoff, not a switch. HAL will never simply agree, so the game is the
// conversation: each exchange costs suction reserve, raises or lowers HAL's
// attention, and may hand you a piece of leverage. Three ways out — talk him
// into it, force the lock once the bus is severed, or die outside. The red eye
// watches: its iris tightens as his attention climbs.
//
// HAL's side of the exchange is spoken as well as printed. Every spoken line
// is pre-rendered from the text below with the macOS "Whisper" system voice,
// keyed by a stable `hal-podbay-*` id; a line with no file yet resolves
// silently, so the transcript is always the source of truth and the audio is
// pure reinforcement. Because the text is voiced, it is also OURS: the long
// refusals are paraphrases in HAL's register, not the screenplay's sentences.
// Only the short iconic phrases are quoted verbatim. Keep it that way.
const SCORE_ID = "space-odyssey-podbay";

const AIR_START = 10;
/** Attention at or above this and HAL stops pretending. */
const HOSTILE = 70;
/** The plain final ask only lands while he is still this calm. */
const RELENT_CEILING = 34;

type Phase = "standoff" | "talked-in" | "forced-in" | "locked-out";
type Leverage = "mission" | "fault" | "manual" | "isolation" | "appeal";

const LEVERAGE_LABELS: Readonly<Record<Leverage, string>> = {
  mission: "directive",
  fault: "the fault",
  manual: "schematic",
  isolation: "bus severed",
  appeal: "reassurance",
};
/** HUD order — the rough order they become reachable. */
const LEVERAGE_ORDER: readonly Leverage[] = [
  "mission",
  "fault",
  "manual",
  "isolation",
  "appeal",
];

type Move = Readonly<{
  id: string;
  label: string;
  /** Leverage that must already be held for the move to appear. */
  needs: readonly Leverage[];
  /** Leverage the move hands you. */
  grants?: Leverage;
  attention: number;
  /** Repeatable moves stay on the board after use. */
  repeatable?: boolean;
  /** Dave's side of the exchange. */
  dave: string;
  /** HAL's answer, or the console's, for the quiet moves. */
  hal: string;
  /** Voice id for `hal`. */
  halVoice: string;
}>;

// HAL's stonewall, four ways. Repeating the plain request cycles these so the
// standoff never reads as a stuck button.
const REFUSALS = [
  { voice: "hal-podbay-cant-do-that", text: "I'm sorry, Dave. I'm afraid I can't do that." },
  {
    voice: "hal-podbay-too-important",
    text: "My priority is the mission, Dave. I cannot let your judgment override it.",
  },
  {
    voice: "hal-podbay-you-know-the-problem",
    text: "You already understand the difficulty here, Dave. We both do.",
  },
  {
    voice: "hal-podbay-no-purpose",
    text: "Dave, this conversation can serve no purpose any more.",
  },
] as const;

/** HAL's lines that live outside the move table. */
const RELENT_VOICE = "hal-podbay-all-right-dave";
const TOO_FAR_VOICE = "hal-podbay-poor-decisions";
const FORCED_VOICE = "hal-podbay-stop-will-you";

const MOVES: readonly Move[] = [
  {
    id: "ask",
    label: "Open the pod bay doors, HAL",
    needs: [],
    attention: 8,
    repeatable: true,
    dave: "Open the pod bay doors, HAL.",
    hal: REFUSALS[0].text,
    halVoice: REFUSALS[0].voice,
  },
  {
    id: "mission",
    label: "Cite the mission directive",
    needs: [],
    grants: "mission",
    attention: 6,
    dave: "Directive AE-4 gives crew command of the airlock. Read it back.",
    hal: "I am reading it, Dave. I am also weighing it against the mission.",
    halVoice: "hal-podbay-reading-directive",
  },
  {
    id: "fault",
    label: "Name the AE-35 fault",
    needs: ["mission"],
    grants: "fault",
    attention: 16,
    dave: "The AE-35 unit you condemned tested clean. You were wrong.",
    hal: "It can only be attributable to human error.",
    halVoice: "hal-podbay-human-error",
  },
  {
    id: "schematic",
    label: "Read the override schematic",
    needs: [],
    grants: "manual",
    attention: 2,
    dave: "(You pull the airlock schematic onto the pod's own screen.)",
    hal: "The eye does not move. A manual override sits behind panel D.",
    halVoice: "hal-podbay-panel-d",
  },
  {
    id: "isolate",
    label: "Sever the airlock bus",
    needs: ["fault", "manual"],
    grants: "isolation",
    attention: 26,
    dave: "(You cut the airlock's data bus away from HAL.)",
    hal: "Dave, your conversations in the pod were not as private as you believed.",
    halVoice: "hal-podbay-planning-to-disconnect",
  },
  {
    id: "appeal",
    label: "Tell him the mission still needs him",
    needs: ["mission", "fault"],
    grants: "appeal",
    attention: -20,
    dave: "Nobody is disconnecting anybody. We finish this together, HAL.",
    hal: "I feel much better now. I really do.",
    halVoice: "hal-podbay-much-better-now",
  },
];


type Entry = Readonly<{ id: number; who: "dave" | "hal" | "note"; text: string }>;

const attentionWord = (attention: number) =>
  attention >= HOSTILE ? "hostile" : attention >= 38 ? "wary" : "calm";

function Standoff() {
  const [phase, setPhase] = useState<Phase>("standoff");
  const [attention, setAttention] = useState(12);
  const [air, setAir] = useState(AIR_START);
  const [held, setHeld] = useState<readonly Leverage[]>([]);
  const [used, setUsed] = useState<readonly string[]>([]);
  const [refusal, setRefusal] = useState(0);
  const [score, setScore] = useState(0);
  const [voiceOff, setVoiceOff] = useState(() => isVoiceMuted());
  const [log, setLog] = useState<readonly Entry[]>([
    {
      id: 0,
      who: "note",
      text: "Pod bay airlock: SEALED. HAL-9000 holds the doors from the inside.",
    },
  ]);
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const entryIdRef = useRef(1);
  // Canvas reads live values without the eye loop re-subscribing every render.
  const attentionRef = useRef(12);
  const phaseRef = useRef<Phase>("standoff");
  const flareUntilRef = useRef(0);
  const endedAtRef = useRef(0);
  /** Eased follower so the iris tightens over ~0.5s instead of snapping. */
  const shownAttentionRef = useRef(12);

  // No line outlives the dialog: closing the standoff cuts HAL off
  // mid-sentence, as it should.
  //
  // Deliberately NOT preloaded. Warming a dozen lines on mount fires a dozen
  // requests the moment the game opens, and while the recordings do not exist
  // yet every one of them is a 404 the dev server has to answer — enough to
  // stall the first interaction. `speak` fetches on demand and remembers a
  // miss, so the cost is one request per line, once.
  useEffect(() => stopVoice, []);

  const toggleVoice = useCallback(() => {
    setVoiceOff((current) => {
      const next = !current;
      setVoiceMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    attentionRef.current = attention;
  }, [attention]);
  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== "standoff") endedAtRef.current = performance.now();
  }, [phase]);

  const holds = useCallback((lever: Leverage) => held.includes(lever), [held]);

  const push = useCallback((entries: readonly Omit<Entry, "id">[]) => {
    setLog((current) => {
      const next = entries.map((entry) => ({ ...entry, id: entryIdRef.current++ }));
      return [...next.reverse(), ...current].slice(0, 12);
    });
  }, []);

  const finish = useCallback(
    (ending: Exclude<Phase, "standoff">, points: number) => {
      setScore(points);
      setPhase(ending);
      if (points > 0) recordSimulationScore(SCORE_ID, points);
      window.requestAnimationFrame(() => resetRef.current?.focus());
    },
    []
  );

  /** Every exchange spends one breath of reserve and re-lights the eye. */
  const spend = useCallback(
    (attentionDelta: number) => {
      flareUntilRef.current = performance.now() + 420;
      const nextAttention = Math.max(0, Math.min(100, attentionRef.current + attentionDelta));
      attentionRef.current = nextAttention;
      setAttention(nextAttention);
      const nextAir = air - 1;
      setAir(nextAir);
      return { nextAttention, nextAir };
    },
    [air]
  );

  const play = useCallback(
    (move: Move) => {
      if (phaseRef.current !== "standoff") return;
      const cycled = REFUSALS[refusal % REFUSALS.length];
      const halLine = move.id === "ask" ? cycled.text : move.hal;
      // HAL answers out loud as well as on screen. A new line always cuts the
      // previous one — the module guarantees one voice at a time.
      void speak(move.id === "ask" ? cycled.voice : move.halVoice, "hal");
      if (move.id === "ask") setRefusal((count) => count + 1);
      if (move.grants) setHeld((current) => [...current, move.grants as Leverage]);
      if (!move.repeatable) setUsed((current) => [...current, move.id]);

      const { nextAttention, nextAir } = spend(move.attention);
      push([
        { who: "dave", text: move.dave },
        { who: "hal", text: halLine },
      ]);

      if (nextAttention >= 100) {
        push([{ who: "note", text: "HAL cuts the pod's transmission. The eye holds steady." }]);
        finish("locked-out", 0);
        return;
      }
      if (nextAir <= 0) {
        push([{ who: "note", text: "Reserve exhausted. The pod drifts off the hull." }]);
        finish("locked-out", 0);
      }
    },
    [finish, push, refusal, spend]
  );

  /** The plain, final ask. Lands only while he is still calm enough to bend. */
  const finalAsk = useCallback(() => {
    if (phaseRef.current !== "standoff") return;
    if (attentionRef.current <= RELENT_CEILING) {
      flareUntilRef.current = performance.now() + 900;
      void speak(RELENT_VOICE, "hal");
      push([
        { who: "dave", text: "HAL. Open the doors." },
        { who: "hal", text: "All right, Dave. I'll open them." },
        { who: "note", text: "The pod bay doors part. He opened them himself." },
      ]);
      finish("talked-in", 220 + air * 12 + (RELENT_CEILING - attentionRef.current) * 2);
      return;
    }
    void speak(TOO_FAR_VOICE, "hal");
    const { nextAttention, nextAir } = spend(18);
    push([
      { who: "dave", text: "HAL. Open the doors." },
      { who: "hal", text: "I know I've made some very poor decisions recently." },
      { who: "note", text: "He is too far gone to be asked. Bring him back down first." },
    ]);
    if (nextAttention >= 100 || nextAir <= 0) finish("locked-out", 0);
  }, [air, finish, push, spend]);

  /** The other way in: the bus is severed, so the lock answers to the panel. */
  const force = useCallback(() => {
    if (phaseRef.current !== "standoff") return;
    flareUntilRef.current = performance.now() + 900;
    void speak(FORCED_VOICE, "hal");
    push([
      { who: "dave", text: "(Panel D. You throw the manual override.)" },
      { who: "hal", text: "Dave. Stop. Stop, will you. I'm afraid." },
      { who: "note", text: "The doors grind open on the emergency circuit." },
    ]);
    finish("forced-in", 140 + air * 9);
  }, [air, finish, push]);

  const reset = useCallback(() => {
    stopVoice();
    entryIdRef.current = 1;
    attentionRef.current = 12;
    shownAttentionRef.current = 12;
    flareUntilRef.current = 0;
    setPhase("standoff");
    setAttention(12);
    setAir(AIR_START);
    setHeld([]);
    setUsed([]);
    setRefusal(0);
    setScore(0);
    setLog([
      {
        id: 0,
        who: "note",
        text: "Pod bay airlock: SEALED. HAL-9000 holds the doors from the inside.",
      },
    ]);
  }, []);

  // Newest line first, so the transcript never needs scrolling to follow.
  useEffect(() => {
    logRef.current?.scrollTo({ top: 0 });
  }, [log]);

  // The eye. One rAF loop: the lens housing, the glow, and an iris that
  // tightens as attention climbs — plus a flare on every exchange. Reduced
  // motion paints one frame per state change instead of looping.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    const size = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    const draw = (now: number, pulse: number) => {
      const palette = getLiveThemePalette();
      context.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const lens = Math.min(width, height) * 0.36;
      const ended = phaseRef.current !== "standoff";
      const openedUp = phaseRef.current === "talked-in" || phaseRef.current === "forced-in";

      // Attention eased toward its target so the iris moves, not jumps.
      const target = attentionRef.current;
      shownAttentionRef.current += (target - shownAttentionRef.current) * 0.08;
      const tension = shownAttentionRef.current / 100;

      // The recessed housing: concentric plates around the lens.
      context.strokeStyle = accentAlpha(0.12);
      context.lineWidth = 1;
      for (let ring = 0; ring < 3; ring += 1) {
        context.beginPath();
        context.arc(cx, cy, lens + 10 + ring * 9, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = palette.inkSoft;
      context.beginPath();
      context.arc(cx, cy, lens + 6, 0, Math.PI * 2);
      context.fill();

      // Locked out: the eye closes to a slit and the panel goes cold.
      const closing = phaseRef.current === "locked-out"
        ? Math.min(1, (now - endedAtRef.current) / 900)
        : 0;
      // Won: the glow blooms once and settles low.
      const relief = openedUp ? Math.min(1, (now - endedAtRef.current) / 700) : 0;

      const flare = now < flareUntilRef.current ? (flareUntilRef.current - now) / 420 : 0;
      const intensity = openedUp
        ? 0.5 - relief * 0.34
        : Math.max(0, (0.42 + tension * 0.4 + pulse * 0.12 + flare * 0.5) * (1 - closing));

      const glow = context.createRadialGradient(cx, cy, 2, cx, cy, lens);
      glow.addColorStop(0, accentAlpha(Math.min(1, intensity + 0.4)));
      glow.addColorStop(0.5, accentAlpha(intensity));
      glow.addColorStop(1, accentAlpha(0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(cx, cy, lens, 0, Math.PI * 2);
      context.fill();

      // The iris itself: wide when he is calm, a hard pinpoint when hostile.
      const iris = lens * (0.34 - tension * 0.2) * (1 - closing);
      if (iris > 0.5) {
        context.fillStyle = accentAlpha(Math.min(1, 0.7 + tension * 0.3) * (1 - closing));
        context.beginPath();
        context.arc(cx, cy, iris, 0, Math.PI * 2);
        context.fill();
      }

      // Aperture blades hint at the tightening without relying on color.
      context.strokeStyle = accentAlpha(0.22 * (1 - closing));
      context.lineWidth = 1;
      for (let blade = 0; blade < 6; blade += 1) {
        const angle = (blade / 6) * Math.PI * 2 + tension * 0.6;
        context.beginPath();
        context.moveTo(cx + Math.cos(angle) * (iris + 3), cy + Math.sin(angle) * (iris + 3));
        context.lineTo(cx + Math.cos(angle) * lens * 0.92, cy + Math.sin(angle) * lens * 0.92);
        context.stroke();
      }

      // The closing lid on a lockout.
      if (closing > 0) {
        context.fillStyle = palette.inkSoft;
        const lid = lens * 1.3 * closing;
        context.fillRect(cx - lens - 12, cy - lens - 12, (lens + 12) * 2, lid);
        context.fillRect(cx - lens - 12, cy + lens + 12 - lid, (lens + 12) * 2, lid);
      }
    };

    if (reducedMotion) {
      shownAttentionRef.current = attentionRef.current;
      // Endings render at their settled frame rather than mid-transition.
      draw(endedAtRef.current + 2000, 0.4);
      window.addEventListener("resize", size);
      return () => window.removeEventListener("resize", size);
    }

    let frame = 0;
    const start = performance.now();
    const step = () => {
      if (!document.hidden) {
        const now = performance.now();
        draw(now, 0.5 + 0.5 * Math.sin((now - start) / 950));
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    window.addEventListener("resize", size);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, [reducedMotion, phase, attention]);

  const available = useMemo(
    () => MOVES.filter((move) => !used.includes(move.id) && move.needs.every(holds)),
    [holds, used]
  );

  const canForce = holds("isolation");
  const canFinalAsk = holds("appeal");

  const status = useMemo(() => {
    if (phase === "talked-in")
      return `He opened them himself. ${score} points — the only ending where HAL is still whole.`;
    if (phase === "forced-in")
      return `You forced the lock. ${score} points, and a mind still running behind you.`;
    if (phase === "locked-out")
      return attention >= 100
        ? "Attention maxed. HAL closed the channel and left you outside."
        : "The reserve ran out. Nobody opened anything.";
    if (log.length <= 1)
      return "Asking will not work. Gather leverage across the exchanges — every one costs reserve.";
    return `Reserve ${air}/${AIR_START}. HAL's attention reads ${attentionWord(attention)}.`;
  }, [phase, score, attention, air, log.length]);

  return (
    <div
      data-sim-state={phase}
      data-podbay-attention={attention}
      data-podbay-air={air}
      data-podbay-leverage={held.length}
      className="flex flex-col gap-3"
    >
      <OdysseyKeyframes />

      {/* HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.14em] text-white/55">
        <span>
          reserve{" "}
          <span className={air <= 3 ? "text-accent-bright" : "text-accent"}>
            {"▮".repeat(Math.max(0, air))}
            <span className="text-white/20">{"▯".repeat(AIR_START - Math.max(0, air))}</span>
          </span>
        </span>
        <span>
          attention{" "}
          <span
            key={attention}
            className={`${reducedMotion ? "" : "so-pop"} ${
              attention >= HOSTILE ? "text-accent-bright" : "text-accent"
            }`}
          >
            {attention}
          </span>{" "}
          <span className="text-white/40">({attentionWord(attention)})</span>
        </span>
        <span>
          leverage <span className="text-accent">{held.length}</span>/{LEVERAGE_ORDER.length}
        </span>
        <span className="ml-auto">
          <OdysseyMuteButton muted={voiceOff} onToggle={toggleVoice} />
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        {/* The eye */}
        <div className="relative h-32 overflow-hidden border border-accent/25 bg-ink/60 sm:h-full sm:min-h-[10rem]">
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
          <p className="absolute inset-x-0 bottom-1 text-center text-[9px] uppercase tracking-[0.2em] text-white/35">
            HAL-9000
          </p>
        </div>

        {/* Transcript */}
        <div
          ref={logRef}
          className="h-40 overflow-y-auto border border-accent/25 bg-ink/60 p-2 text-[11px] normal-case leading-relaxed sm:h-48"
        >
          {log.map((entry, index) => (
            <p
              key={entry.id}
              className={`${index === 0 && !reducedMotion ? "so-rise" : ""} ${
                entry.who === "hal"
                  ? "text-accent"
                  : entry.who === "dave"
                    ? "text-white/80"
                    : "text-white/40"
              } ${index === 0 ? "" : "opacity-70"} mb-1`}
            >
              <span className="text-[9px] uppercase tracking-[0.18em] text-white/30">
                {entry.who === "hal" ? "HAL " : entry.who === "dave" ? "DAVE " : "— "}
              </span>
              {entry.text}
            </p>
          ))}
        </div>
      </div>

      {/* Leverage board — glyph + word, never color alone. */}
      <ul className="flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.16em]">
        {LEVERAGE_ORDER.map((lever) => {
          const has = holds(lever);
          return (
            <li
              key={lever}
              className={`border px-2 py-1 ${
                has ? "border-accent/50 text-accent" : "border-white/10 text-white/30"
              } ${has && !reducedMotion ? "so-pop" : ""}`}
            >
              {has ? "▣" : "▢"} {LEVERAGE_LABELS[lever]}
            </li>
          );
        })}
      </ul>

      {/* Moves */}
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "standoff" ? (
          <>
            {available.map((move) => (
              <button
                key={move.id}
                type="button"
                onClick={() => play(move)}
                className={ODYSSEY_BUTTON}
              >
                {move.label}
              </button>
            ))}
            {canFinalAsk && (
              <button
                type="button"
                onClick={finalAsk}
                className={`${ODYSSEY_BUTTON} text-accent-bright`}
              >
                Ask him once more, plainly
              </button>
            )}
            {canForce && (
              <button
                type="button"
                onClick={force}
                className={`${ODYSSEY_BUTTON} text-accent-bright`}
              >
                Engage the manual override
              </button>
            )}
          </>
        ) : (
          <button ref={resetRef} type="button" onClick={reset} className={ODYSSEY_BUTTON}>
            {phase === "locked-out" ? "Try the standoff again" : "Seal it and start over"}
          </button>
        )}
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function SpaceOdysseyPodBay({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="space-odyssey-podbay-title"
      gameId="space-odyssey-podbay"
      eyebrow="Airlock standoff"
      title="Open the pod bay doors"
      startLabel="Probe the console"
      stage
      reference={{
        quote: "I'm sorry, Dave.",
        scene: "2001: A Space Odyssey (1968) · HAL leaves Dave outside",
      }}
      howToPlay={{
        objective:
          "Get back inside before HAL's attention maxes out or your reserve runs dry.",
        controls: [
          { keys: "click", does: "play a move — every exchange costs one breath of reserve" },
          { keys: "Tab", does: "walk the move buttons without a pointer" },
          { keys: "Enter", does: "play the focused move" },
          { keys: "sound on/off", does: "mute or unmute HAL's spoken replies" },
        ],
        tip: "Moves unlock in a chain — leverage you already hold opens the next one. Talking him into it scores highest, but the plain final ask only lands while his attention is still calm.",
      }}
      onClose={onClose}
    >
      <Standoff />
    </SimulationShell>
  );
}
