"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";
import { accentAlpha } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { randomGlyph } from "@/components/film-experience/simulations/MatrixDecodeData";

// The one binary that starts the film: no score, no timer — deliberately the
// compact shell. The consequence is the show: swallowing a pill animates the
// room rewrite, both branches are worth seeing, and the offer always comes
// back around.
type Stage = "choosing" | "swallow-red" | "swallow-blue" | "red" | "blue";

const RED_LINE = "the room is code. it always was.";
const SWALLOW_RED_MS = 1_700;
const SWALLOW_BLUE_MS = 1_400;
const SCRAMBLE_MS = 1_200;

/**
 * Spoken lines, one per branch. The recordings live at
 * /public/audio/sim-voice/<id>.mp3; until they do, `speak` resolves silently
 * and the game plays exactly as it does today.
 */
const VOICE_RED = "matrix-pill-red";
const VOICE_BLUE = "matrix-pill-blue";

function RedOrBlue() {
  const [stage, setStage] = useState<Stage>("choosing");
  const [seenRed, setSeenRed] = useState(false);
  const [seenBlue, setSeenBlue] = useState(false);
  const [scrambleText, setScrambleText] = useState(RED_LINE);
  const [voiceOff, setVoiceOff] = useState(false);
  const reducedMotion = useReducedMotion();

  const blueRef = useRef<HTMLButtonElement>(null);
  const replayRef = useRef<HTMLButtonElement>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      stopVoice();
    },
    [clearTimers]
  );

  // Focus follows the beat: the offer focuses the first pill, an ending
  // focuses the replay control (the swallow beats have no controls).
  useEffect(() => {
    if (stage === "choosing") {
      window.requestAnimationFrame(() => blueRef.current?.focus());
    } else if (stage === "red" || stage === "blue") {
      window.requestAnimationFrame(() => replayRef.current?.focus());
    }
  }, [stage]);

  const choose = useCallback(
    (color: "red" | "blue") => {
      clearTimers();
      if (color === "red") setSeenRed(true);
      else setSeenBlue(true);
      // The consequence is spoken as it lands, not before the choice.
      void speak(color === "red" ? VOICE_RED : VOICE_BLUE, "matrix");
      if (reducedMotion) {
        // Reduced motion: the rewrite happens as a cut, not a dissolve.
        setStage(color);
        return;
      }
      if (color === "blue") {
        setStage("swallow-blue");
        timersRef.current.push(
          window.setTimeout(() => setStage("blue"), SWALLOW_BLUE_MS)
        );
        return;
      }
      setStage("swallow-red");
      // Character-level dissolve: the sentence resolves out of glyph noise as
      // the wireframe grid fades up behind it.
      const started = performance.now();
      const interval = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - started) / SCRAMBLE_MS);
        setScrambleText(
          RED_LINE.split("")
            .map((ch, index) =>
              ch === " " || index / RED_LINE.length < progress
                ? ch
                : randomGlyph()
            )
            .join("")
        );
        if (progress >= 1) window.clearInterval(interval);
      }, 70);
      timersRef.current.push(interval);
      timersRef.current.push(
        window.setTimeout(() => setStage("red"), SWALLOW_RED_MS)
      );
    },
    [clearTimers, reducedMotion]
  );

  const replay = useCallback(() => {
    clearTimers();
    stopVoice();
    setScrambleText(RED_LINE);
    setStage("choosing");
  }, [clearTimers]);

  const bothSeen = seenRed && seenBlue;

  const voiceToggle = (
    <button
      type="button"
      onClick={() => {
        const next = !voiceOff;
        setVoiceOff(next);
        setVoiceMuted(next);
      }}
      aria-pressed={voiceOff}
      aria-label={voiceOff ? "Unmute spoken lines" : "Mute spoken lines"}
      className="self-start border border-accent/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/60 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {voiceOff ? "voice off" : "voice on"}
    </button>
  );

  const wireframe = (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `repeating-linear-gradient(0deg, ${accentAlpha(0.14)} 0 1px, transparent 1px 14px), repeating-linear-gradient(90deg, ${accentAlpha(0.14)} 0 1px, transparent 1px 14px)`,
      }}
    />
  );

  if (stage === "choosing") {
    return (
      <div data-sim-state="choosing" className="flex flex-col gap-4">
        <style>{`
          @keyframes matrix-pill-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <p
          className="text-[11px] normal-case leading-relaxed text-white/70"
          style={reducedMotion ? undefined : { animation: "matrix-pill-in 500ms ease-out both" }}
        >
          One pill and the story ends. The other, you stay in Wonderland. Choose.
        </p>
        <div className="flex gap-3">
          <button
            ref={blueRef}
            type="button"
            onClick={() => choose("blue")}
            className="flex-1 rounded-full border border-white/25 px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-white/70 transition-transform hover:scale-[1.03] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            Blue pill
          </button>
          <button
            type="button"
            onClick={() => choose("red")}
            className="flex-1 rounded-full border border-accent/50 px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-accent transition-transform hover:scale-[1.03] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            Red pill
          </button>
        </div>
        <p role="status" className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          {bothSeen
            ? "You have seen both sides of the choice."
            : seenRed
              ? "The blue pill is still on the table."
              : seenBlue
                ? "The red pill is still on the table."
                : "Both hands are open."}
        </p>
        {voiceToggle}
      </div>
    );
  }

  if (stage === "swallow-red") {
    return (
      <div data-sim-state="swallow-red" className="relative flex flex-col gap-4 overflow-hidden text-accent">
        {wireframe}
        <p aria-hidden className="relative text-sm normal-case leading-relaxed">
          {scrambleText}
        </p>
        <p role="status" className="relative text-[10px] uppercase tracking-[0.18em] text-white/45">
          The room is rewriting
        </p>
      </div>
    );
  }

  if (stage === "swallow-blue") {
    return (
      <div data-sim-state="swallow-blue" className="relative flex flex-col gap-4 overflow-hidden text-white/70">
        <style>{`
          @keyframes matrix-pill-dim { from { opacity: 0; } to { opacity: 0.75; } }
          @keyframes matrix-pill-blur { from { filter: blur(0); } to { filter: blur(2px); } }
        `}</style>
        <p
          aria-hidden
          className="text-sm normal-case leading-relaxed"
          style={{ animation: `matrix-pill-blur ${SWALLOW_BLUE_MS}ms ease-in both` }}
        >
          The edges of the room soften. Someone is turning the light down.
        </p>
        <p role="status" className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          The story is ending
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-ink"
          style={{ animation: `matrix-pill-dim ${SWALLOW_BLUE_MS}ms ease-in both` }}
        />
      </div>
    );
  }

  const red = stage === "red";
  return (
    <div
      data-sim-state={stage}
      className={`relative flex flex-col gap-4 overflow-hidden ${red ? "text-accent" : "text-white/70"}`}
    >
      <style>{`
        @keyframes matrix-pill-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      {red && wireframe}
      <div
        className="relative flex flex-col gap-4"
        style={reducedMotion ? undefined : { animation: "matrix-pill-in 450ms ease-out both" }}
      >
        <p className="text-sm normal-case leading-relaxed">
          {red
            ? "You stay. The rain resolves into columns and the layout grid shows through — the site as it really renders."
            : "You wake in your bed and believe whatever you want to believe. The page looks exactly as it did."}
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
          {red ? "Down the rabbit hole" : "The story ends"}
        </p>
        <p role="status" className="text-[10px] normal-case tracking-[0.06em] text-white/45">
          {bothSeen
            ? "You have now seen both sides of the choice."
            : red
              ? "The blue pill is still on the table."
              : "The red pill is still on the table."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={replayRef}
            type="button"
            onClick={replay}
            className="border border-accent/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Offer the pills again
          </button>
          {voiceToggle}
        </div>
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function MatrixRedOrBlue({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="matrix-red-or-blue-title"
      gameId="matrix-red-or-blue"
      eyebrow="The choice"
      title="Red pill or blue"
      startLabel="Take the offer"
      howToPlay={{
        objective: "Take one of the two pills and watch where it leaves you.",
        controls: [
          { keys: "Blue pill", does: "end the story and wake where you already were" },
          { keys: "Red pill", does: "stay, and watch the room resolve into code" },
        ],
        tip: "Either ending offers the pills again, so both are yours to see.",
      }}
      reference={{
        quote: "You take the red pill…",
        scene: "The Matrix (1999) · Morpheus's two open palms",
      }}
      onClose={onClose}
    >
      <RedOrBlue />
    </SimulationShell>
  );
}
