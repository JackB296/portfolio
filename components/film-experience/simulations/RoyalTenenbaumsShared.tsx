"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { createAudioContext } from "@/lib/filmAudio";

// Shared plumbing for the three Royal Tenenbaums games: one lazily created
// AudioContext per game (opened on the first user gesture, closed on unmount),
// a visible mute, the small chip button the HUDs use, and the CSS keyframes the
// feedback animations lean on. Every tone is a self-rendered oscillator — the
// film's own music is never sampled here.
//
// The house style across all three games is the archive: mustard book cloth,
// catalogue call numbers, dead-center framing. Tones follow suit — plucked,
// dry, a little parlour-piano.

type ToneSpec = Readonly<{
  freq: number;
  type?: OscillatorType;
  /** Seconds. */
  duration?: number;
  /** Peak gain; kept subtle by default. */
  gain?: number;
  /** Optional glide target, for the hawk's stoop and the shutter. */
  slideTo?: number;
  /** Seconds from now, for small arpeggios. */
  delay?: number;
}>;

export function useTenenbaumAudio() {
  const contextRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const ensureContext = useCallback((): AudioContext | null => {
    let ctx = contextRef.current;
    if (!ctx) {
      ctx = createAudioContext();
      if (!ctx) return null;
      contextRef.current = ctx;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }, []);

  /** Open the context on a real gesture, so autoplay policy never bites. */
  const unlock = useCallback(() => {
    ensureContext();
  }, [ensureContext]);

  const play = useCallback(
    (spec: ToneSpec) => {
      if (mutedRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + (spec.delay ?? 0);
      const duration = spec.duration ?? 0.3;
      const peak = spec.gain ?? 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type ?? "triangle";
      osc.frequency.setValueAtTime(spec.freq, now);
      if (spec.slideTo) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, now + duration);
      // A plucked envelope: overlapping tones never smear or clip.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    },
    [ensureContext]
  );

  // Named voices, so the games read as intent rather than frequencies.
  const voices = useMemo(
    () => ({
      /** A card sliding one place: short, dry, pitched by destination row. */
      page: (row: number) => play({ freq: 320 + row * 44, duration: 0.12, gain: 0.05 }),
      /** A clue card flipping face up. */
      flip: () => play({ freq: 520, type: "sine", duration: 0.14, gain: 0.05 }),
      /** The rubber stamp on a correctly filed act. */
      stamp: () => {
        play({ freq: 180, type: "square", duration: 0.09, gain: 0.07 });
        play({ freq: 660, duration: 0.24, gain: 0.06, delay: 0.05 });
      },
      /** A refusal: the drawer will not close. */
      wrong: () => play({ freq: 138, type: "square", duration: 0.26, gain: 0.06 }),
      /** The hawk loosed from the glove. */
      loose: () => play({ freq: 300, slideTo: 720, duration: 0.3, gain: 0.06 }),
      /** The glove catch — pitch climbs with the streak. */
      land: (streak: number) => {
        const base = 392 * Math.pow(2, Math.min(6, streak) / 12);
        play({ freq: base, duration: 0.16, gain: 0.08 });
        play({ freq: base * 1.5, duration: 0.3, gain: 0.06, delay: 0.07 });
      },
      /** The lure swung up. */
      lure: () => play({ freq: 240, slideTo: 400, type: "sine", duration: 0.28, gain: 0.05 }),
      /** The camera shutter tripping. */
      shutter: () => {
        play({ freq: 900, type: "square", duration: 0.05, gain: 0.06 });
        play({ freq: 420, type: "square", duration: 0.07, gain: 0.05, delay: 0.05 });
      },
      /** A subject set down in the frame. */
      place: (column: number) => play({ freq: 300 + column * 60, duration: 0.11, gain: 0.05 }),
      /** The closing chord: an act shelved, the novel bound, the last flight flown. */
      win: () => {
        [392, 494, 587, 784].forEach((freq, index) =>
          play({ freq, duration: 0.5, gain: 0.055, delay: index * 0.1 })
        );
      },
      /** The run ends badly. */
      fail: () => {
        play({ freq: 196, type: "square", duration: 0.3, gain: 0.06 });
        play({ freq: 147, type: "square", duration: 0.45, gain: 0.05, delay: 0.12 });
      },
    }),
    [play]
  );

  // Close the context on unmount so no audio graph outlives the dialog.
  useEffect(() => {
    return () => {
      const ctx = contextRef.current;
      contextRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  return useMemo(
    () => ({ muted, setMuted, unlock, play, ...voices }),
    [muted, unlock, play, voices]
  );
}

/** The small bordered control the three HUDs share. */
export function TenenbaumChip({
  children,
  onClick,
  innerRef,
  bright = false,
  disabled = false,
  ariaLabel,
  ariaPressed,
}: {
  children: ReactNode;
  onClick: () => void;
  innerRef?: Ref<HTMLButtonElement>;
  bright?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
}) {
  return (
    <button
      ref={innerRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={`tnb-press border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35 ${
        bright
          ? "border-accent bg-accent/15 text-accent hover:bg-accent/25"
          : "border-accent/35 text-white/75 hover:bg-accent/10 hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

/** The visible mute every audible Tenenbaums game carries. */
export function TenenbaumMuteButton({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <TenenbaumChip onClick={onToggle} ariaPressed={muted} ariaLabel={muted ? "Unmute" : "Mute"}>
      {muted ? "sound off" : "sound on"}
    </TenenbaumChip>
  );
}

/**
 * Feedback keyframes shared by the three games. Everything sits behind
 * `prefers-reduced-motion: no-preference`, so a reduced-motion visitor gets
 * instant state changes rather than movement — never a broken or blank frame.
 */
export function TenenbaumKeyframes() {
  return (
    <style>{`
.tnb-press { transition: transform 90ms ease-out; }
@media (prefers-reduced-motion: no-preference) {
  .tnb-press:active { transform: scale(0.95); }
  @keyframes tnb-page-turn {
    0% { transform: perspective(600px) rotateX(0deg); opacity: 1; }
    45% { transform: perspective(600px) rotateX(-38deg); opacity: 0.55; }
    100% { transform: perspective(600px) rotateX(0deg); opacity: 1; }
  }
  @keyframes tnb-card-in {
    from { transform: translateY(10px) rotate(-1.2deg); opacity: 0; }
    to { transform: translateY(0) rotate(0deg); opacity: 1; }
  }
  @keyframes tnb-stamp {
    0% { transform: scale(2.2) rotate(-11deg); opacity: 0; }
    55% { transform: scale(0.92) rotate(-7deg); opacity: 1; }
    100% { transform: scale(1) rotate(-7deg); opacity: 1; }
  }
  @keyframes tnb-shake {
    0%, 100% { transform: translateX(0); }
    18% { transform: translateX(-5px); }
    38% { transform: translateX(4px); }
    58% { transform: translateX(-3px); }
    78% { transform: translateX(2px); }
  }
  @keyframes tnb-pop {
    0% { transform: scale(1.4); }
    100% { transform: scale(1); }
  }
  @keyframes tnb-float {
    0% { transform: translateY(4px); opacity: 0; }
    28% { transform: translateY(-2px); opacity: 1; }
    100% { transform: translateY(-20px); opacity: 0; }
  }
  @keyframes tnb-develop {
    from { filter: brightness(0.15) contrast(0.5); opacity: 0.25; }
    to { filter: brightness(1) contrast(1); opacity: 1; }
  }
  .tnb-turn { animation: tnb-page-turn 320ms ease-in-out; }
  .tnb-in { animation: tnb-card-in 260ms ease-out both; }
  .tnb-stamp { display: inline-block; animation: tnb-stamp 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
  .tnb-shake { animation: tnb-shake 340ms ease-in-out; }
  .tnb-pop { display: inline-block; animation: tnb-pop 220ms ease-out; }
  .tnb-float { animation: tnb-float 1100ms ease-out both; }
  .tnb-develop { animation: tnb-develop 900ms ease-out both; }
}
`}</style>
  );
}
