"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import SimulationShell from "@/components/film-experience/SimulationShell";
import {
  CasablancaKeyframes,
  CasablancaMuteButton,
  useCasablancaAudio,
} from "@/components/film-experience/simulations/CasablancaShared";
import { recordSimulationScore } from "@/lib/simulationScores";
import { accentAlpha, getLiveThemePalette } from "@/lib/theme";
import { useFreshPress } from "@/lib/useFreshPress";
import { useReducedMotion } from "@/lib/useReducedMotion";

// The fog-bound airfield across five nights. Hold to spin the propellers up —
// the fog thickens with the throttle — and release inside the clearance window.
// A clean release earns one more beat: press again for the goodbye before the
// moment passes. Each night the fog is thicker and the window narrower.
const NIGHTS = [
  { window: 0.24, spinup: 2200 },
  { window: 0.19, spinup: 2050 },
  { window: 0.15, spinup: 1900 },
  { window: 0.12, spinup: 1800 },
  { window: 0.1, spinup: 1700 },
] as const;
// Reduced motion keeps the hold loop (it IS the mechanic) but slows the
// spin-up, widens the window on every night, and never times the goodbye out.
const REDUCED = { window: 0.42, spinup: 3200 } as const;
const FAREWELL_MS = 900;
const TAXI_MS = 1400;
const FADE_MS = 900;
const SCORE_ID = "casablanca-runway";

type Phase = "ready" | "holding" | "farewell" | "departed" | "stalled" | "done";
type StallReason = "early" | "flooded" | "missed-goodbye";

function Airfield() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [night, setNight] = useState(0);
  const [departures, setDepartures] = useState(0);
  const [stallReason, setStallReason] = useState<StallReason>("early");
  const reducedMotion = useReducedMotion();
  const audio = useCasablancaAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const windowCueRef = useRef<HTMLParagraphElement>(null);
  const holdRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef(0);
  const startedRef = useRef(0);
  const holdFractionRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const farewellTimerRef = useRef(0);
  // When a phase change swaps the action button in place, the trailing click of
  // the very gesture that caused the change can land on the new button. We
  // reject it by gesture identity: a real tap on the new button starts its own
  // press AFTER the phase changed; the stray click's press happened before.
  const { freshPress, markPress } = useFreshPress(phase);
  const taxiStartRef = useRef(0);
  const fadeStartRef = useRef(0);
  const propAngleRef = useRef(0);
  const nightRef = useRef(0);
  // Reduced-motion value readable from stable callbacks without re-creating them.
  const reducedMotionLiveRef = useRef(false);
  useEffect(() => {
    reducedMotionLiveRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    nightRef.current = night;
  }, [night]);

  const spinup = reducedMotion ? REDUCED.spinup : NIGHTS[night].spinup;
  const clearance = reducedMotion ? REDUCED.window : NIGHTS[night].window;

  const clearFarewellTimer = () => {
    if (farewellTimerRef.current) window.clearTimeout(farewellTimerRef.current);
    farewellTimerRef.current = 0;
  };

  const arm = useCallback((nextNight: number, resetDepartures: boolean) => {
    clearFarewellTimer();
    holdFractionRef.current = 0;
    if (barRef.current) barRef.current.style.width = "0%";
    setNight(nextNight);
    if (resetDepartures) setDepartures(0);
    setPhase("ready");
    window.requestAnimationFrame(() => holdRef.current?.focus());
  }, []);

  useEffect(() => {
    arm(0, true);
    return clearFarewellTimer;
  }, [arm]);

  const stall = useCallback(
    (reason: StallReason) => {
      clearFarewellTimer();
      audio.stopDrone();
      audio.play({ freq: 82, type: "square", duration: 0.4, gain: 0.07 });
      fadeStartRef.current = performance.now();
      setStallReason(reason);
      phaseRef.current = "stalled";
      setPhase("stalled");
    },
    [audio]
  );

  const beginHold = useCallback(() => {
    if (phaseRef.current !== "ready") return;
    startedRef.current = performance.now();
    audio.startDrone(55);
    phaseRef.current = "holding";
    setPhase("holding");
  }, [audio]);

  const release = useCallback(() => {
    if (phaseRef.current !== "holding") return;
    audio.stopDrone();
    const fraction = holdFractionRef.current;
    const windowNow = reducedMotionLiveRef.current
      ? REDUCED.window
      : NIGHTS[nightRef.current].window;
    if (fraction >= 1 - windowNow) {
      // Inside the window: one beat left — the goodbye itself.
      audio.play({ freq: 392, duration: 0.25, gain: 0.08 });
      phaseRef.current = "farewell";
      setPhase("farewell");
      if (!reducedMotionLiveRef.current) {
        farewellTimerRef.current = window.setTimeout(() => {
          farewellTimerRef.current = 0;
          stall("missed-goodbye");
        }, FAREWELL_MS);
      }
    } else {
      stall("early");
    }
  }, [audio, stall]);

  const farewell = useCallback(() => {
    if (phaseRef.current !== "farewell") return;
    clearFarewellTimer();
    audio.play({ freq: 392, duration: 0.2, gain: 0.08 });
    audio.play({ freq: 523.25, duration: 0.4, gain: 0.08, delay: 0.12 });
    taxiStartRef.current = performance.now();
    const isLastNight = nightRef.current + 1 >= NIGHTS.length;
    setDepartures((count) => {
      const next = count + 1;
      recordSimulationScore(SCORE_ID, next);
      return next;
    });
    phaseRef.current = isLastNight ? "done" : "departed";
    setPhase(isLastNight ? "done" : "departed");
  }, [audio]);

  // The scene: one rAF loop paints fog, searchlight, runway lights, and the
  // plane, and advances the hold meter. Reduced motion skips the painterly
  // loop; a lightweight meter-only loop runs during the hold instead.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    const updateHold = () => {
      if (phaseRef.current !== "holding") return;
      const fraction = Math.min(
        1,
        (performance.now() - startedRef.current) /
          (reducedMotionLiveRef.current ? REDUCED.spinup : NIGHTS[nightRef.current].spinup)
      );
      holdFractionRef.current = fraction;
      if (barRef.current) barRef.current.style.width = `${(fraction * 100).toFixed(1)}%`;
      const windowNow = reducedMotionLiveRef.current
        ? REDUCED.window
        : NIGHTS[nightRef.current].window;
      if (windowCueRef.current) {
        windowCueRef.current.classList.toggle("hidden", fraction < 1 - windowNow);
      }
      audio.setDroneFreq(55 + fraction * 180);
      if (fraction >= 1) stall("flooded");
    };

    const drawScene = (now: number) => {
      if (!canvas || !context) return;
      const width = canvas.width;
      const height = canvas.height;
      const palette = getLiveThemePalette();
      context.clearRect(0, 0, width, height);
      const ground = height - 34;
      const fraction = phaseRef.current === "holding" ? holdFractionRef.current : phaseRef.current === "farewell" ? 1 : 0.12;

      // Searchlight: a slow sweep from the tower on the right.
      const beamAngle = Math.PI * 1.18 + Math.sin(now / 2600) * 0.35;
      context.save();
      context.globalAlpha = 0.06;
      context.fillStyle = palette.bright;
      context.beginPath();
      context.moveTo(width - 26, ground);
      context.lineTo(width - 26 + Math.cos(beamAngle) * width * 1.2 - 60, ground + Math.sin(beamAngle) * width * 1.2);
      context.lineTo(width - 26 + Math.cos(beamAngle + 0.16) * width * 1.2 + 60, ground + Math.sin(beamAngle + 0.16) * width * 1.2);
      context.closePath();
      context.fill();
      context.restore();

      // Runway line and its pulsing lights.
      context.strokeStyle = accentAlpha(0.35);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, ground);
      context.lineTo(width, ground);
      context.stroke();
      for (let x = 14; x < width; x += 34) {
        const pulse = 0.35 + 0.3 * Math.abs(Math.sin(now / 500 + x * 0.08));
        context.fillStyle = accentAlpha(pulse);
        context.beginPath();
        context.arc(x, ground + 8, 2, 0, Math.PI * 2);
        context.fill();
      }

      // The plane: silhouette with propellers whose spin follows the throttle.
      let planeX = width * 0.3;
      const isAway = phaseRef.current === "departed" || phaseRef.current === "done";
      if (isAway) {
        const t = reducedMotionLiveRef.current
          ? 1
          : Math.min(1, (now - taxiStartRef.current) / TAXI_MS);
        planeX = width * 0.3 + t * t * width * 0.95;
      }
      const jitter =
        phaseRef.current === "farewell" || phaseRef.current === "holding"
          ? Math.sin(now / 24) * fraction * 1.4
          : 0;
      const py = ground - 20 + jitter;
      context.fillStyle = accentAlpha(0.85);
      // Fuselage.
      context.beginPath();
      context.ellipse(planeX, py, 46, 8, 0, 0, Math.PI * 2);
      context.fill();
      // Tail fin.
      context.beginPath();
      context.moveTo(planeX - 44, py);
      context.lineTo(planeX - 56, py - 16);
      context.lineTo(planeX - 38, py - 2);
      context.closePath();
      context.fill();
      // Wing.
      context.beginPath();
      context.ellipse(planeX + 2, py + 2, 20, 4, -0.08, 0, Math.PI * 2);
      context.fill();
      // Gear.
      context.strokeStyle = accentAlpha(0.7);
      context.beginPath();
      context.moveTo(planeX - 8, py + 7);
      context.lineTo(planeX - 8, ground - 2);
      context.moveTo(planeX + 14, py + 7);
      context.lineTo(planeX + 14, ground - 2);
      context.stroke();
      // Propeller: blades spin with throttle; a faint disc blooms at speed.
      const propSpeed = 0.12 + fraction * 1.7 + (isAway ? 1.7 : 0);
      propAngleRef.current += propSpeed;
      const nose = planeX + 46;
      context.strokeStyle = palette.bright;
      context.lineWidth = 2;
      for (let blade = 0; blade < 3; blade += 1) {
        const a = propAngleRef.current + (blade * Math.PI * 2) / 3;
        context.beginPath();
        context.moveTo(nose, py);
        context.lineTo(nose + Math.cos(a) * 3, py + Math.sin(a) * 14);
        context.stroke();
      }
      context.strokeStyle = accentAlpha(0.12 + fraction * 0.25);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(nose, py, 15, 0, Math.PI * 2);
      context.stroke();

      // Fog: drifting soft discs; density builds with throttle and the night.
      const density = 0.05 + nightRef.current * 0.012 + fraction * 0.07;
      context.fillStyle = accentAlpha(density);
      for (let band = 0; band < 3; band += 1) {
        const y = height * (0.28 + band * 0.22);
        const offset = ((now / (46 - band * 9)) % (width + 240)) - 120;
        for (let i = -1; i < 4; i += 1) {
          context.beginPath();
          context.ellipse(((offset + i * (width / 3) + width) % (width + 240)) - 120, y, 130, 22 + band * 6, 0, 0, Math.PI * 2);
          context.fill();
        }
      }

      // Heartbreak fade on a stall: the field dims to nothing.
      if (phaseRef.current === "stalled") {
        const t = reducedMotionLiveRef.current
          ? 1
          : Math.min(1, (now - fadeStartRef.current) / FADE_MS);
        context.save();
        context.globalAlpha = t * 0.78;
        context.fillStyle = palette.inkSoft;
        context.fillRect(0, 0, width, height);
        context.restore();
      }
    };

    if (canvas && context) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    if (reducedMotion) {
      // Meter-only loop while holding; the canvas stays a still frame.
      drawScene(performance.now());
      if (phase !== "holding") return;
      let frame = 0;
      const tick = () => {
        updateHold();
        if (phaseRef.current === "holding") frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(frame);
    }

    let frame = 0;
    const step = () => {
      if (!document.hidden) {
        updateHold();
        drawScene(performance.now());
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    rafRef.current = frame;
    return () => window.cancelAnimationFrame(frame);
  }, [audio, phase, reducedMotion, stall]);

  // Keyboard hold on the button: Space/Enter down starts (or says the
  // goodbye), up releases. preventDefault stops key-repeat and the synthetic
  // click from double-firing.
  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (event.repeat) return;
        if (phaseRef.current === "ready") beginHold();
        else if (phaseRef.current === "farewell") farewell();
      }
    },
    [beginHold, farewell]
  );
  const onKeyUp = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        release();
      }
    },
    [release]
  );

  const status = useMemo(() => {
    if (phase === "done") return `The last plane is away — ${departures} flights, none missed.`;
    if (phase === "departed") return `Here's looking at you, kid. ${departures} away safely.`;
    if (phase === "stalled") {
      if (stallReason === "flooded") return "Held too long — the engines flood on the tarmac.";
      if (stallReason === "missed-goodbye") return "The window passed with the goodbye unsaid.";
      return "Released too soon — the plane never rolled.";
    }
    if (phase === "farewell") return "Now — press once more for the goodbye.";
    if (phase === "holding") return "Hold as the propellers climb — release in the lit window.";
    return `Night ${night + 1} of ${NIGHTS.length} — press and hold to spin up the engines.`;
  }, [phase, departures, stallReason, night]);

  const over = phase === "departed" || phase === "stalled" || phase === "done";

  return (
    <div
      data-sim-state={phase}
      data-runway-departures={departures}
      data-runway-night={night + 1}
      className="flex flex-col gap-3"
      // Capture runs before any child handler, so every press is timestamped
      // even when the hold button stops propagation.
      onPointerDownCapture={markPress}
    >
      <CasablancaKeyframes />

      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-white/45">
        <span>
          Night {night + 1} / {NIGHTS.length}
        </span>
        <span>Clearance {(clearance * 100).toFixed(0)}%</span>
        <span>Flights away: {departures}</span>
      </div>

      <div
        className="relative"
        style={{ touchAction: "none" }}
        onPointerDown={() => {
          if (phaseRef.current === "ready") beginHold();
          else if (phaseRef.current === "farewell") farewell();
        }}
        onPointerUp={release}
        onPointerLeave={release}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="h-48 w-full border border-accent/25 bg-ink/60 sm:h-56"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative h-3 flex-1 overflow-hidden border border-accent/25 bg-white/5">
          {/* The clearance window sits at the far end of the spin-up track. */}
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 border-l border-accent/60 bg-accent/20"
            style={{ width: `${clearance * 100}%` }}
          />
          <div ref={barRef} className="h-full bg-accent/80" style={{ width: "0%" }} />
        </div>
        <p
          ref={windowCueRef}
          aria-hidden
          className="hidden shrink-0 text-[9px] uppercase tracking-[0.18em] text-accent"
        >
          Window open
        </p>
      </div>

      <p role="status" className="text-[11px] normal-case leading-relaxed text-white/70">
        {status}
      </p>

      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]">
        {phase === "ready" || phase === "holding" ? (
          <button
            ref={holdRef}
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (phaseRef.current === "ready") beginHold();
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              release();
            }}
            onPointerLeave={release}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            className="border border-accent/40 px-4 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
            style={{ touchAction: "none" }}
          >
            {phase === "holding" ? "Hold…" : "Hold to depart"}
          </button>
        ) : phase === "farewell" ? (
          // The goodbye is a discrete tap on its own element, fired on click
          // (not pointerdown): if it morphed on pointerdown, the trailing click
          // of the same gesture would fall through to "Next departure" and skip
          // the departed beat entirely.
          <button
            type="button"
            onClick={() => {
              if (freshPress()) farewell();
            }}
            className="border border-accent/40 px-4 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            Say the goodbye
          </button>
        ) : phase === "departed" ? (
          <button
            type="button"
            onClick={() => {
              if (freshPress()) arm(night + 1, false);
            }}
            className="border border-accent/40 px-3 py-1.5 text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Next departure
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (freshPress()) arm(0, true);
            }}
            className="border border-accent/30 px-3 py-1.5 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {phase === "done" ? "Fly the nights again" : "Ready the next flight"}
          </button>
        )}
        <CasablancaMuteButton muted={audio.muted} onToggle={() => audio.setMuted(!audio.muted)} />
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function CasablancaRunway({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="casablanca-runway-title"
      gameId="casablanca-runway"
      eyebrow="Departing airfield"
      title="The runway goodbye"
      startLabel="Walk to the plane"
      stage
      howToPlay={{
        objective: "Get a plane away on all five nights of thickening fog.",
        controls: [
          { keys: "hold", does: "press and hold the stage or the button to spin the propellers up" },
          { keys: "release", does: "let go while the lit clearance window at the end of the track is open" },
          { keys: "Space / Enter", does: "hold and release the same way with the button focused" },
          { keys: "press again", does: "say the goodbye in the beat right after a clean release" },
        ],
        tip: "Let the meter run to the end and the engines flood; release before the window and the plane never rolls. The goodbye needs its own deliberate press — the tail of the hold gesture will not count, and it times out in under a second. Reduced motion widens every window and never times the goodbye out.",
      }}
      reference={{
        quote: "Here's looking at you, kid.",
        scene: "Casablanca (1943) · the fog-bound airfield farewell",
      }}
      onClose={onClose}
    >
      <Airfield />
    </SimulationShell>
  );
}
