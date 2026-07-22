"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette, type LiveThemePalette } from "@/lib/theme";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { BleepsToggle, useBladeRunnerBleeps } from "@/components/film-experience/simulations/BladeRunnerBleeps";
import { rankFor } from "@/components/film-experience/simulations/BladeRunnerRank";
import { isVoiceMuted, preloadVoice, setVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";

// A full interrogation session. Each subject hides three involuntary tells —
// pupil dilation, response cadence, blink gap — and the operator chooses which
// instruments to spend before making the call. Fewer probes, bigger payout:
// confidence is the wager. The rule is fair and stated up front so the session
// is learnable: two or more flagged channels read replicant.
const DILATION_LIMIT = 55; // percent; above flags
const CADENCE_LIMIT = 620; // ms; under flags (the answer comes back too fast)
const BLINK_LIMIT = 4; // seconds between blinks; above flags
const WRONG_PENALTY = 2; // a wrong call costs wager × 2
const SCORE_ID = "blade-runner-vk";

type Channel = "dilation" | "cadence" | "blink";
type Verdict = "human" | "replicant";
type Phase = "running" | "done";

type Subject = Readonly<{
  code: string;
  intro: string;
  prompt: string;
  dilation: number; // percent
  cadenceMs: number;
  blinkGapS: number;
  replicant: boolean;
}>;

// Prompts are our own paraphrases — the interrogation's shape, not its
// dialogue. Fixed order keeps the session deterministic (and testable). The
// arc sharpens: early subjects read clean across every channel; later ones
// split 2-of-3 with borderline values, so one probe stops being enough.
const SUBJECTS: readonly Subject[] = [
  { code: "K-114", intro: "Applicant for an off-world clerical transfer.", prompt: "Describe the last meal your mother cooked for you.", dilation: 38, cadenceMs: 840, blinkGapS: 2.8, replicant: false },
  { code: "N-227", intro: "Detained at the docks without a work card.", prompt: "A tortoise lies on its back in the sun. You do nothing. Why?", dilation: 72, cadenceMs: 430, blinkGapS: 5.2, replicant: true },
  { code: "L-081", intro: "Waitress. Claims eight years behind the same bar.", prompt: "Tell me about a photograph you keep and never show.", dilation: 61, cadenceMs: 710, blinkGapS: 4.6, replicant: true },
  { code: "R-309", intro: "Courier who cannot say what he carries.", prompt: "You are handed a wallet of another's memories. Are they yours?", dilation: 58, cadenceMs: 780, blinkGapS: 3.1, replicant: false },
  { code: "M-450", intro: "Says she dreams in photographs.", prompt: "Your childhood dog waits at a door that no longer exists.", dilation: 47, cadenceMs: 540, blinkGapS: 4.8, replicant: true },
  { code: "C-772", intro: "Volunteered for the test. Nobody volunteers.", prompt: "Someone gives you a calfskin wallet on your birthday.", dilation: 52, cadenceMs: 590, blinkGapS: 3.8, replicant: false },
] as const;

// One spoken line per question, in subject order. The recordings live at
// /public/audio/sim-voice/<id>.mp3 and are entirely optional: `speak` resolves
// silently when a file is absent, so the session plays identically today and
// gains a voice the moment an MP3 lands under one of these ids.
const VOICE_IDS: readonly string[] = SUBJECTS.map((_, i) => `blade-runner-vk-q${i + 1}`);

const flagsFor = (subject: Subject) => ({
  dilation: subject.dilation > DILATION_LIMIT,
  cadence: subject.cadenceMs < CADENCE_LIMIT,
  blink: subject.blinkGapS > BLINK_LIMIT,
});

type LogEntry = Readonly<{ code: string; call: Verdict; truth: Verdict; delta: number }>;

type EyeFrame = {
  dilation: number; // 0–1 shown
  lid: number; // 0 open – 1 closed
  scan: number;
  flash: "hit" | "miss" | null;
};

/** The VK monitor: iris, pupil, eyelid, scanline, corner brackets. */
function drawEye(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  eye: EyeFrame,
  palette: LiveThemePalette
) {
  context.fillStyle = palette.inkSoft;
  context.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const irisR = Math.min(width, height) * 0.36;

  for (let ring = 6; ring >= 1; ring -= 1) {
    context.beginPath();
    context.arc(cx, cy, (irisR * ring) / 6, 0, Math.PI * 2);
    context.strokeStyle = accentAlpha(0.1 + ring * 0.05);
    context.lineWidth = 1;
    context.stroke();
  }
  for (let spoke = 0; spoke < 48; spoke += 1) {
    const angle = (spoke / 48) * Math.PI * 2;
    context.beginPath();
    context.moveTo(cx + Math.cos(angle) * irisR * 0.32, cy + Math.sin(angle) * irisR * 0.32);
    context.lineTo(cx + Math.cos(angle) * irisR, cy + Math.sin(angle) * irisR);
    context.strokeStyle = accentAlpha(0.14);
    context.stroke();
  }
  const pupilR = irisR * (0.18 + eye.dilation * 0.5);
  context.beginPath();
  context.arc(cx, cy, pupilR, 0, Math.PI * 2);
  context.fillStyle = "rgba(0, 0, 0, 0.92)";
  context.fill();
  context.strokeStyle = accentAlpha(0.85);
  context.lineWidth = 1.5;
  context.stroke();
  context.beginPath();
  context.arc(cx - pupilR * 0.32, cy - pupilR * 0.32, Math.max(1.5, pupilR * 0.14), 0, Math.PI * 2);
  context.fillStyle = accentAlpha(0.7);
  context.fill();

  // Eyelid sweep during a blink.
  if (eye.lid > 0.01) {
    const cover = (height / 2) * eye.lid;
    context.fillStyle = "rgba(0, 0, 0, 0.82)";
    context.fillRect(0, 0, width, cover);
    context.fillRect(0, height - cover, width, cover);
  }

  // Scanline drift.
  context.fillStyle = accentAlpha(0.07);
  context.fillRect(0, eye.scan, width, 2);

  // Corner brackets — instrument framing.
  const b = Math.min(width, height) * 0.08;
  context.strokeStyle = accentAlpha(0.4);
  context.lineWidth = 1;
  for (const [x, y, dx, dy] of [
    [4, 4, 1, 1],
    [width - 4, 4, -1, 1],
    [4, height - 4, 1, -1],
    [width - 4, height - 4, -1, -1],
  ] as const) {
    context.beginPath();
    context.moveTo(x + dx * b, y);
    context.lineTo(x, y);
    context.lineTo(x, y + dy * b);
    context.stroke();
  }

  // Verdict flash tints the frame edge.
  if (eye.flash) {
    context.strokeStyle = eye.flash === "hit" ? accentAlpha(0.9) : "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, width - 3, height - 3);
  }
}

function VoightKampffSession() {
  const [index, setIndex] = useState(0);
  const [probed, setProbed] = useState<Record<Channel, boolean>>({ dilation: false, cadence: false, blink: false });
  const [wager, setWager] = useState(1);
  const [called, setCalled] = useState<Verdict | null>(null);
  const [lastDelta, setLastDelta] = useState(0);
  const [chips, setChips] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [log, setLog] = useState<readonly LogEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("running");
  const [cadenceBarOn, setCadenceBarOn] = useState(false);
  const reducedMotion = useReducedMotion();
  const { play, muted, toggleMuted } = useBladeRunnerBleeps();
  const [voiceOff, setVoiceOff] = useState(() => isVoiceMuted());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probePupilRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);

  // Eye readout state lives in refs so the single rAF loop animates without
  // re-rendering: shown dilation eases toward the target; a probed replicant's
  // pupil keeps creeping past its reading — the visible tell.
  const shownRef = useRef(0.3);
  const targetRef = useRef(0.3);
  const driftRef = useRef(false);
  const blinkGapRef = useRef(0);
  const scanRef = useRef(0);
  const flashRef = useRef<{ kind: "hit" | "miss"; until: number } | null>(null);

  const subject = SUBJECTS[index];
  const done = phase === "done";
  const flags = flagsFor(subject);
  const probesUsed = Number(probed.dilation) + Number(probed.cadence) + Number(probed.blink);
  const truth: Verdict = subject.replicant ? "replicant" : "human";
  const hit = called !== null && called === truth;

  // Per-subject reset of the instrument refs.
  useEffect(() => {
    targetRef.current = 0.3;
    driftRef.current = false;
    blinkGapRef.current = 0;
    flashRef.current = null;
  }, [index]);

  // The examiner asks the question aloud. Warm the whole set once, then speak
  // whichever subject is in the chair — one line at a time, cut when the
  // session moves on, and silent for good when the visitor mutes voice or the
  // recording does not exist yet.
  useEffect(() => {
    preloadVoice(VOICE_IDS);
    return () => stopVoice();
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    void speak(VOICE_IDS[index], "vk");
  }, [index, phase]);

  // Focus flow: probe first on each subject, the advance button after a call,
  // the restart control on the case file.
  useEffect(() => {
    if (phase === "running") window.requestAnimationFrame(() => probePupilRef.current?.focus());
  }, [index, phase]);
  useEffect(() => {
    if (called) window.requestAnimationFrame(() => nextRef.current?.focus());
  }, [called]);
  useEffect(() => {
    if (phase === "done") window.requestAnimationFrame(() => restartRef.current?.focus());
  }, [phase]);

  // The pupil monitor. One rAF loop; a static frame under reduced motion;
  // suspends while the tab is hidden.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const width = (canvas.width = canvas.offsetWidth);
    const height = (canvas.height = canvas.offsetHeight);
    const palette = getLiveThemePalette();

    if (reducedMotion) {
      drawEye(
        context,
        width,
        height,
        {
          dilation: probed.dilation ? subject.dilation / 100 : 0.3,
          lid: 0,
          scan: height * 0.4,
          flash: called ? (called === truth ? "hit" : "miss") : null,
        },
        palette
      );
      return;
    }

    let frame = 0;
    const step = (now: number) => {
      if (!document.hidden) {
        if (driftRef.current) {
          targetRef.current = Math.min(targetRef.current + 0.0004, subject.dilation / 100 + 0.08);
        }
        shownRef.current += (targetRef.current - shownRef.current) * 0.07;
        let lid = 0;
        if (blinkGapRef.current > 0) {
          const gap = blinkGapRef.current * 1000;
          const t = (now % gap) / gap;
          const closeSpan = 150 / gap;
          if (t < closeSpan) lid = Math.sin((t / closeSpan) * Math.PI);
        }
        scanRef.current = (scanRef.current + 0.5) % height;
        const flash = flashRef.current && now < flashRef.current.until ? flashRef.current.kind : null;
        drawEye(context, width, height, { dilation: shownRef.current, lid, scan: scanRef.current, flash }, palette);
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, subject, probed.dilation, called, truth]);

  const probe = useCallback(
    (channel: Channel) => {
      if (done || called || probed[channel]) return;
      play("probe");
      setProbed((current) => ({ ...current, [channel]: true }));
      if (channel === "dilation") {
        targetRef.current = subject.dilation / 100;
        driftRef.current = subject.replicant;
      }
      if (channel === "blink") blinkGapRef.current = subject.blinkGapS;
      if (channel === "cadence") {
        setCadenceBarOn(false);
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => setCadenceBarOn(true)));
      }
    },
    [called, done, play, probed, subject]
  );

  const call = useCallback(
    (verdict: Verdict) => {
      if (done || called || probesUsed === 0) return;
      const correct = verdict === truth;
      const delta = correct ? wager * (4 - probesUsed) : -(wager * WRONG_PENALTY);
      setCalled(verdict);
      setLastDelta(delta);
      setChips((current) => Math.max(0, current + delta));
      setStreak((current) => {
        const next = correct ? current + 1 : 0;
        if (correct) setBestStreak((best) => Math.max(best, next));
        return next;
      });
      setLog((current) => [...current, { code: subject.code, call: verdict, truth, delta }]);
      flashRef.current = { kind: correct ? "hit" : "miss", until: performance.now() + 600 };
      play(correct ? "hit" : "miss");
    },
    [called, done, play, probesUsed, subject.code, truth, wager]
  );

  const advance = useCallback(() => {
    if (!called) return;
    if (index + 1 < SUBJECTS.length) {
      setIndex(index + 1);
      setProbed({ dilation: false, cadence: false, blink: false });
      setWager(1);
      setCalled(null);
      setCadenceBarOn(false);
      return;
    }
    setPhase("done");
    play(chips >= 18 ? "win" : "lose");
    recordSimulationScore(SCORE_ID, chips);
  }, [called, chips, index, play]);

  const restart = useCallback(() => {
    setIndex(0);
    setProbed({ dilation: false, cadence: false, blink: false });
    setWager(1);
    setCalled(null);
    setLastDelta(0);
    setChips(0);
    setStreak(0);
    setBestStreak(0);
    setLog([]);
    setCadenceBarOn(false);
    setPhase("running");
    shownRef.current = 0.3;
  }, []);

  const status = useMemo(() => {
    if (done) return `Session closed. ${chips} chips banked across ${SUBJECTS.length} subjects.`;
    if (called) {
      return hit
        ? `Confirmed. ${subject.code} reads ${truth}. ${lastDelta > 0 ? `+${lastDelta} chips.` : ""} ${streak > 1 ? `Streak ×${streak}.` : ""}`
        : `Miss. Baseline said ${truth}. ${lastDelta} chips.`;
    }
    if (probesUsed === 0) return `Subject ${index + 1} of ${SUBJECTS.length}. Spend a probe before you call it.`;
    return `Subject ${index + 1} of ${SUBJECTS.length}. ${probesUsed} probe${probesUsed === 1 ? "" : "s"} spent — call it or keep reading.`;
  }, [called, chips, done, hit, index, lastDelta, probesUsed, streak, subject.code, truth]);

  const rank = rankFor(chips, 36, 18);

  const readout = (channel: Channel, label: string, value: string, flagged: boolean) => (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-1">
      <span className="text-white/50">{label}</span>
      {probed[channel] ? (
        <span className={flagged ? "text-accent" : "text-white/80"}>
          {value}
          {flagged && <span aria-hidden> ▲</span>}
          <span className="sr-only">{flagged ? " — flagged" : " — clear"}</span>
        </span>
      ) : (
        <span className="text-white/30">— unprobed</span>
      )}
    </div>
  );

  return (
    <div data-sim-state={phase} data-vk-index={index + 1} data-vk-chips={chips} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em]">
        <p className="text-white/45">
          Two or more flags read replicant · dilation &gt;{DILATION_LIMIT}% · response &lt;{CADENCE_LIMIT}ms · blink gap &gt;{BLINK_LIMIT.toFixed(1)}s
        </p>
        <div className="flex items-center gap-3">
          <span className="text-white/60">
            chips <span className="text-accent">{chips}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !voiceOff;
              setVoiceMuted(next);
              setVoiceOff(next);
            }}
            aria-pressed={!voiceOff}
            aria-label={voiceOff ? "Unmute the spoken questions" : "Mute the spoken questions"}
            className="border border-accent/30 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/60 hover:bg-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {voiceOff ? "voice off" : "voice on"}
          </button>
          <BleepsToggle muted={muted} onToggle={toggleMuted} />
        </div>
      </div>

      {done ? (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Case file · session summary</p>
          <ul className="flex flex-col gap-1 text-[11px]">
            {log.map((entry) => (
              <li key={entry.code} className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-1">
                <span className="text-white/70">
                  {entry.code} — called {entry.call}, was {entry.truth}
                </span>
                <span className={entry.delta >= 0 ? "text-accent" : "text-white/50"}>
                  {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/80">
            Rating: <span className="text-accent">{rank}</span> · {chips} chips · best streak ×{bestStreak}
          </p>
          <button
            ref={restartRef}
            type="button"
            onClick={restart}
            className="self-start border border-accent/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Run a new session
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <canvas ref={canvasRef} aria-hidden className="h-48 w-full border border-accent/25 bg-ink/60 sm:h-56" />
            <div className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.1em]">
              {readout("dilation", "Pupil dilation", `${subject.dilation}%`, flags.dilation)}
              {readout("cadence", "Response time", `${subject.cadenceMs}ms`, flags.cadence)}
              {readout("blink", "Blink gap", `${subject.blinkGapS.toFixed(1)}s`, flags.blink)}
            </div>
            {probed.cadence && (
              <div aria-hidden className="h-1 w-full border border-accent/20 bg-ink/60">
                <div
                  className="h-full bg-accent/60"
                  style={{
                    width: reducedMotion || cadenceBarOn ? "100%" : "0%",
                    transition: reducedMotion ? "none" : `width ${subject.cadenceMs}ms linear`,
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 text-[11px]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                {subject.code} <span className="text-white/45">· subject {index + 1} of {SUBJECTS.length}</span>
              </p>
              <p className="mt-1 normal-case leading-relaxed text-white/60">{subject.intro}</p>
              <p className="mt-2 normal-case leading-relaxed text-white/85">&ldquo;{subject.prompt}&rdquo;</p>
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
              <button
                ref={probePupilRef}
                type="button"
                onClick={() => probe("dilation")}
                disabled={probed.dilation || called !== null}
                className="border border-accent/30 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Probe pupil
              </button>
              <button
                type="button"
                onClick={() => probe("cadence")}
                disabled={probed.cadence || called !== null}
                className="border border-accent/30 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Probe cadence
              </button>
              <button
                type="button"
                onClick={() => probe("blink")}
                disabled={probed.blink || called !== null}
                className="border border-accent/30 px-2.5 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Probe blink
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
              <span className="text-white/45">Wager</span>
              {[1, 2, 3].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setWager(amount)}
                  aria-pressed={wager === amount}
                  disabled={called !== null}
                  className={`border px-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${
                    wager === amount ? "border-accent bg-accent/15 text-accent" : "border-accent/30 hover:bg-accent/10"
                  }`}
                >
                  Wager {amount} chip{amount === 1 ? "" : "s"}
                </button>
              ))}
              <span className="text-white/40 normal-case">
                pays +{wager * Math.max(1, 4 - Math.max(1, probesUsed))} · miss −{wager * WRONG_PENALTY}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
              <button
                type="button"
                onClick={() => call("human")}
                disabled={called !== null || probesUsed === 0}
                className="border border-accent/40 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Call human
              </button>
              <button
                type="button"
                onClick={() => call("replicant")}
                disabled={called !== null || probesUsed === 0}
                className="border border-accent/40 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
              >
                Call replicant
              </button>
            </div>

            {called && (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`-rotate-3 border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] ${
                    hit ? "border-accent text-accent" : "border-white/50 text-white/70"
                  }`}
                >
                  {hit ? `Confirmed +${lastDelta}` : `Miss ${lastDelta}`}
                </span>
                <button
                  ref={nextRef}
                  type="button"
                  onClick={advance}
                  className="border border-accent/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {index + 1 < SUBJECTS.length ? "Next subject" : "Open the case file"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <p role="status" className="text-[10px] uppercase tracking-[0.12em] text-white/55">
        {status}
      </p>
    </div>
  );
}

type Props = { onClose: () => void };

export default function BladeRunnerVoightKampff({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="blade-runner-vk-title"
      gameId="blade-runner-vk"
      eyebrow="Empathy baseline"
      title="Voight-Kampff"
      startLabel="Begin the baseline"
      stage
      howToPlay={{
        objective:
          "Read six subjects and call each one human or replicant, banking chips on the calls you get right.",
        controls: [
          { keys: "probe", does: "spend an instrument — pupil, cadence, or blink — to reveal that channel" },
          { keys: "wager", does: "stake 1, 2, or 3 chips before you commit to the call" },
          { keys: "call", does: "declare human or replicant; at least one probe must be spent first" },
          { keys: "next", does: "move to the next subject once the verdict has landed" },
        ],
        tip: "Two or more flagged channels read replicant. Confidence is the wager: a correct call pays wager × (4 − probes spent), so fewer probes pay more, and a miss costs wager × 2.",
      }}
      reference={{
        quote: "Tell me about your mother.",
        scene: "Blade Runner · the empathy interrogation, the pupil, the desert questions",
      }}
      onClose={onClose}
    >
      <VoightKampffSession />
    </SimulationShell>
  );
}
