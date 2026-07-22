"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CLIP_FRAME_ORIGIN,
  CLIP_PLAYBACK_EVENT,
  clipEmbedSrc,
  clipWatchUrl,
  simulationClips,
} from "@/lib/simulationClips";
import SimulationDialog from "@/components/film-experience/SimulationDialog";

/**
 * The reference layer every simulation carries: the short quote that jogs the
 * memory, and the scene it alludes to. Quotes stay under ~10 words — short
 * phrases carry no copyright; longer passages are not ours to use. The clip
 * itself comes from lib/simulationClips.ts, keyed by the game's id.
 */
export type SimulationReference = Readonly<{
  quote?: string;
  scene: string;
}>;

/** One row of the controls table on the how-to-play card. */
export type SimulationControl = Readonly<{
  /** The key, chord, or gesture — "Space", "← →", "drag", "tap a card". */
  keys: string;
  /** What it does, in the player's words. */
  does: string;
}>;

export type SimulationHowToPlay = Readonly<{
  /** One sentence: what winning looks like. */
  objective: string;
  controls: readonly SimulationControl[];
  /** Optional extra beat — a scoring rule or the one non-obvious catch. */
  tip?: string;
}>;

type SimulationShellProps = {
  /** Id for the dialog heading (aria-labelledby wiring). */
  titleId: string;
  /** Simulation id — the key into the clip registry. */
  gameId?: string;
  eyebrow: string;
  title: string;
  reference: SimulationReference;
  /** Objective and controls, shown before the game starts. */
  howToPlay?: SimulationHowToPlay;
  /** Label for the control that starts the game from the reference card. */
  startLabel: string;
  /** Widens the dialog for games that need a play field. */
  wide?: boolean;
  /** Full featured-experience size: a large responsive stage for games with
   * a real play area. Takes precedence over `wide`. */
  stage?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * The card that fronts each film simulation — the quote, how to play, and the
 * scene itself, so the allusion lands before the mechanic does — wrapped in the
 * shared SimulationDialog chrome. Games render as children once the visitor
 * starts, and the card stays reachable behind a "← back".
 */
export default function SimulationShell({
  titleId,
  gameId,
  eyebrow,
  title,
  reference,
  howToPlay,
  startLabel,
  wide = false,
  stage = false,
  onClose,
  children,
}: SimulationShellProps) {
  const startRef = useRef<HTMLButtonElement>(null);
  const [started, setStarted] = useState(false);

  const clip = gameId ? simulationClips[gameId] : undefined;
  const embed = clipEmbedSrc(clip);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Two soundtracks must never play over each other. The player reports its own
  // state over postMessage (enablejsapi), so the film score ducks the moment the
  // clip starts and returns when it stops — no polling, no YouTube script.
  //
  // Keyed on `started` as well as `embed`: starting the game unmounts the player
  // mid-video, which stops it without any state message ever arriving. Tearing
  // this effect down at the same moment is what hands the score back.
  useEffect(() => {
    if (!embed || started) return;
    let ducked = false;
    const setDucked = (playing: boolean) => {
      if (ducked === playing) return;
      ducked = playing;
      window.dispatchEvent(
        new CustomEvent(CLIP_PLAYBACK_EVENT, { detail: { playing } })
      );
    };

    // The frame only starts reporting once it has been asked to.
    const listen = () => {
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
        CLIP_FRAME_ORIGIN
      );
    };
    const handshake = window.setInterval(listen, 500);
    listen();

    const onMessage = (event: MessageEvent) => {
      // Anything not from the player frame is ignored outright.
      if (event.origin !== CLIP_FRAME_ORIGIN) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      let data: unknown;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      const info = (data as { info?: { playerState?: number } } | null)?.info;
      if (typeof info?.playerState !== "number") return;
      // 1 playing, 3 buffering — both mean the clip owns the room. 2 paused,
      // 0 ended, -1 unstarted give the score back.
      const state = info.playerState;
      if (state === 1 || state === 3) setDucked(true);
      else if (state === 2 || state === 0 || state === -1) setDucked(false);
      if (state === 1) window.clearInterval(handshake);
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.clearInterval(handshake);
      window.removeEventListener("message", onMessage);
      // Closing the card (or starting the game) must always hand the score back.
      setDucked(false);
    };
  }, [embed, started]);

  return (
    <SimulationDialog
      titleId={titleId}
      eyebrow={eyebrow}
      title={title}
      onClose={onClose}
      initialFocusRef={startRef}
      widthClassName={stage || embed ? "max-w-4xl" : wide ? "max-w-md" : "max-w-sm"}
      panelClassName="sm:p-5"
      closeLabel="Close simulation"
      ownsKeyboard
      headerLead={
        // Once a game is running, the card is still reachable via "← back": the
        // quote, the controls, and the scene are reference material a player may
        // want mid-run, not a one-time splash.
        started ? (
          <button
            type="button"
            onClick={() => setStarted(false)}
            aria-label="Back to the scene and how to play"
            className="mt-0.5 shrink-0 border border-accent/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/60 transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ← back
          </button>
        ) : undefined
      }
    >
      {started ? (
        children
      ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            {/* Left: the allusion, then how to play, then the way in. */}
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {reference.quote && (
                <p className="text-sm normal-case leading-relaxed text-white/85">
                  &ldquo;{reference.quote}&rdquo;
                </p>
              )}
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                {reference.scene}
              </p>

              {howToPlay && (
                <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-accent/80">
                    How to play
                  </p>
                  <p className="text-[12px] normal-case leading-relaxed text-white/75">
                    {howToPlay.objective}
                  </p>
                  <dl className="mt-1 flex flex-col gap-1">
                    {howToPlay.controls.map((control) => (
                      <div key={control.keys} className="flex items-baseline gap-3">
                        <dt className="shrink-0">
                          <span className="inline-block rounded-sm border border-accent/35 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-accent">
                            {control.keys}
                          </span>
                        </dt>
                        <dd className="min-w-0 text-[12px] normal-case leading-relaxed text-white/65">
                          {control.does}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {howToPlay.tip && (
                    <p className="mt-1 text-[11px] normal-case leading-relaxed text-white/50">
                      {howToPlay.tip}
                    </p>
                  )}
                </div>
              )}

              <button
                ref={startRef}
                type="button"
                onClick={() => setStarted(true)}
                className="self-start border border-accent/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {startLabel}
              </button>
            </div>

            {/* Right: the scene itself, in YouTube's own player. Never
              * autoplayed, never covered, never resized below the size the
              * platform's terms require. */}
            {clip && embed && (
              <figure className="flex w-full flex-col gap-2 sm:w-[302px] sm:shrink-0">
                <div className="aspect-video w-full min-w-[240px] overflow-hidden border border-white/15 bg-black">
                  <iframe
                    ref={frameRef}
                    src={embed}
                    title={`${clip.label} — the scene on YouTube`}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
                <figcaption className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                  {clip.label} ·{" "}
                  <a
                    href={clipWatchUrl(clip)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    watch on YouTube ↗
                  </a>
                </figcaption>
              </figure>
            )}
          </div>
        )}
    </SimulationDialog>
  );
}
