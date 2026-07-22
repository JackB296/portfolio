"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { getFilmExperience, type ResolvedAudioCue } from "@/lib/films";
import { CLIP_PLAYBACK_EVENT } from "@/lib/simulationClips";
import { setMusicAnalyser } from "./shared";

export type AudioDirectorStatus = Readonly<{
  state: "off" | "running" | "suspended";
  filmId: string | null;
  musicSource: string | null;
  effectSources: readonly string[];
  nodeCount: number;
  trackCount: number;
}>;

// The whole interface is the props: filmId names the mix, enabled arms it,
// and every answer ("did it start", "is it suspended") flows back through
// onStatus. There is deliberately no imperative handle — one channel means
// one generation counter guards the async races.
type AudioDirectorProps = {
  filmId: string | null;
  enabled: boolean;
  onStatus: (status: AudioDirectorStatus) => void;
};

type SampleTrack = {
  filmId: string;
  cue: ResolvedAudioCue;
  buffer: AudioBuffer;
  bus: GainNode;
  filter: BiquadFilterNode;
  sources: Set<AudioBufferSourceNode>;
  primarySource: AudioBufferSourceNode | null;
  nextTriggerAt: number;
  triggerIndex: number;
};

type SampleMix = {
  filmId: string;
  /** null when the film has no music bed and runs on effects alone. */
  musicSource: string | null;
  effectSources: readonly string[];
  tracks: readonly SampleTrack[];
};

function trackNodeCount(track: SampleTrack) {
  return 2 + track.sources.size;
}

function stopTrack(track: SampleTrack) {
  track.sources.forEach((source) => {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Fast switches can stop a short event after it has already ended.
    }
    source.disconnect();
  });
  track.sources.clear();
  track.filter.disconnect();
  track.bus.disconnect();
}

function createSource(track: SampleTrack) {
  const source = track.bus.context.createBufferSource();
  source.buffer = track.buffer;
  source.connect(track.filter);
  track.sources.add(source);
  source.onended = () => {
    track.sources.delete(source);
    source.disconnect();
    if (track.primarySource === source) track.primarySource = null;
  };
  return source;
}

function triggerEvent(track: SampleTrack, context: AudioContext) {
  const duration = Math.min(
    track.cue.segmentDuration ?? track.buffer.duration,
    track.buffer.duration
  );
  const availableOffset = Math.max(track.buffer.duration - duration, 0);
  const offset = availableOffset
    ? ((track.triggerIndex * 0.61803398875) % 1) * availableOffset
    : 0;
  const source = createSource(track);
  source.start(0, offset, duration);
  track.triggerIndex += 1;
  track.nextTriggerAt = context.currentTime + track.cue.triggerCooldownMs / 1_000;
}

function createTrack(
  context: AudioContext,
  filmId: string,
  cue: ResolvedAudioCue,
  buffer: AudioBuffer
) {
  const bus = context.createGain();
  const filter = context.createBiquadFilter();
  const track: SampleTrack = {
    filmId,
    cue,
    buffer,
    bus,
    filter,
    sources: new Set(),
    primarySource: null,
    nextTriggerAt: 0,
    triggerIndex: 0,
  };

  bus.gain.value = 0;
  filter.type = "lowpass";
  filter.frequency.value = cue.filterFrequency;
  filter.Q.value = 0.4;
  filter.connect(bus);

  if (cue.mode === "event") {
    triggerEvent(track, context);
  } else {
    const source = createSource(track);
    source.loop = true;
    // A cue's startAt skips the recording's intro: begin there and loop back
    // to the same point, clamped so a short buffer still plays something.
    const startAt = Math.min(
      cue.startAt ?? 0,
      Math.max(buffer.duration - 0.1, 0)
    );
    if (startAt > 0) {
      source.loopStart = startAt;
      source.loopEnd = buffer.duration;
    }
    source.start(0, startAt);
    track.primarySource = source;
  }

  return track;
}

function scheduleReturn(
  parameter: AudioParam,
  now: number,
  peak: number,
  resting: number
) {
  parameter.cancelScheduledValues(now);
  parameter.setValueAtTime(parameter.value, now);
  parameter.linearRampToValueAtTime(peak, now + 0.07);
  parameter.linearRampToValueAtTime(resting, now + 0.62);
}

function respondToScroll(track: SampleTrack, context: AudioContext, delta: number) {
  const velocity = Math.min(Math.abs(delta) / 68, 1);

  if (track.cue.mode === "event") {
    if (
      velocity >= track.cue.triggerThreshold &&
      context.currentTime >= track.nextTriggerAt
    ) {
      triggerEvent(track, context);
    }
    return;
  }

  const response = velocity * track.cue.scrollResponse;
  if (response < 0.005) return;

  const now = context.currentTime;
  scheduleReturn(
    track.bus.gain,
    now,
    Math.min(track.cue.volume * (1 + response * track.cue.scrollGain), 0.85),
    track.cue.volume
  );
  scheduleReturn(
    track.filter.frequency,
    now,
    Math.min(track.cue.filterFrequency * (1 + response * 0.35), 22_000),
    track.cue.filterFrequency
  );

  const playbackRate = track.primarySource?.playbackRate;
  const scrollRate = track.cue.scrollRate;
  if (playbackRate && scrollRate > 0) {
    scheduleReturn(
      playbackRate,
      now,
      1 + response * scrollRate,
      1
    );
  }
}

export const OFF_AUDIO_STATUS: AudioDirectorStatus = {
  state: "off",
  filmId: null,
  musicSource: null,
  effectSources: [],
  nodeCount: 0,
  trackCount: 0,
};

export default function AudioDirector({ filmId, enabled, onStatus }: AudioDirectorProps) {
    const { scrollY } = useScroll();
    const contextRef = useRef<AudioContext | null>(null);
    const masterRef = useRef<GainNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const currentRef = useRef<SampleMix | null>(null);
    // True while an embedded scene clip is playing; survives effect re-runs.
    const clipPlayingRef = useRef(false);
    const tracksRef = useRef(new Set<SampleTrack>());
    const timersRef = useRef(new Set<number>());
    const bufferCacheRef = useRef(new Map<string, Promise<AudioBuffer>>());
    const generationRef = useRef(0);
    const statusCallbackRef = useRef(onStatus);
    useEffect(() => {
      statusCallbackRef.current = onStatus;
    }, [onStatus]);

    const report = useCallback(
      (status: AudioDirectorStatus) => statusCallbackRef.current(status),
      []
    );

    const reportCurrent = useCallback(
      (state: AudioDirectorStatus["state"]) => {
        const current = currentRef.current;
        report({
          state,
          filmId: current?.filmId ?? null,
          musicSource: current?.musicSource ?? null,
          effectSources: current?.effectSources ?? [],
          nodeCount: [...tracksRef.current].reduce(
            (count, track) => count + trackNodeCount(track),
            0
          ),
          trackCount: tracksRef.current.size,
        });
      },
      [report]
    );

    useMotionValueEvent(scrollY, "change", (latest) => {
      const previous = scrollY.getPrevious() ?? latest;
      const context = contextRef.current;
      const current = currentRef.current;
      if (!enabled || !context || context.state !== "running" || !current) return;
      current.tracks.forEach((track) =>
        respondToScroll(track, context, latest - previous)
      );
    });

    const stopEverything = useCallback(() => {
      generationRef.current += 1;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      tracksRef.current.forEach(stopTrack);
      tracksRef.current.clear();
      currentRef.current = null;
      bufferCacheRef.current.clear();
      masterRef.current?.disconnect();
      masterRef.current = null;
      analyserRef.current?.disconnect();
      analyserRef.current = null;
      setMusicAnalyser(null);
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== "closed") void context.close();
      report(OFF_AUDIO_STATUS);
    }, [report]);

    const startFilm = useCallback(
      async (nextFilmId: string | null) => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        const experience = getFilmExperience(nextFilmId);
        if (!experience || !nextFilmId) {
          stopEverything();
          return false;
        }

        try {
          let context = contextRef.current;
          let master = masterRef.current;
          if (!context || context.state === "closed" || !master) {
            context = new AudioContext();
            master = context.createGain();
            master.gain.value = 0.72;
            master.connect(context.destination);
            contextRef.current = context;
            masterRef.current = master;
            // A passive tap for the canvas layer: modes read band levels from
            // this analyser so visuals can follow the music (see shared.ts).
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.82;
            analyserRef.current = analyser;
            setMusicAnalyser(analyser);
          }

          if (context.state === "suspended") await context.resume();
          if (generation !== generationRef.current || contextRef.current !== context) {
            return false;
          }
          if (currentRef.current?.filmId === nextFilmId) {
            reportCurrent("running");
            return true;
          }

          // A film may run on effects alone; the music bed is optional, and the
          // rest of the pipeline (fades, analyser tap, scroll response) is
          // per-cue, so an absent bed simply contributes no track.
          const music = experience.audio.music;
          const cues: readonly ResolvedAudioCue[] = music
            ? [music, ...experience.audio.effects]
            : experience.audio.effects;
          if (cues.length === 0) {
            stopEverything();
            return false;
          }
          const loadBuffer = (audioCue: ResolvedAudioCue) => {
            let promise = bufferCacheRef.current.get(audioCue.src);
            if (!promise) {
              // Revalidate rather than force-cache: film-mode recordings are
              // swapped in place at stable URLs, so an aggressive cache would
              // keep replaying stale audio after a track is replaced.
              promise = fetch(audioCue.src, { cache: "no-cache" })
                .then((response) => {
                  if (!response.ok) {
                    throw new Error(`Audio request failed: ${response.status}`);
                  }
                  return response.arrayBuffer();
                })
                .then((data) => context.decodeAudioData(data));
              bufferCacheRef.current.set(audioCue.src, promise);
              void promise.catch(() => {
                if (bufferCacheRef.current.get(audioCue.src) === promise) {
                  bufferCacheRef.current.delete(audioCue.src);
                }
              });
            }
            return promise;
          };
          const buffers = await Promise.all(cues.map(loadBuffer));
          if (
            generation !== generationRef.current ||
            contextRef.current !== context ||
            context.state === "closed"
          ) {
            return false;
          }

          timersRef.current.forEach((timer) => window.clearTimeout(timer));
          timersRef.current.clear();
          const previous = currentRef.current;
          tracksRef.current.forEach((track) => {
            if (!previous?.tracks.includes(track)) {
              stopTrack(track);
              tracksRef.current.delete(track);
            }
          });

          const now = context.currentTime;
          const nextTracks = cues.map((audioCue, index) => {
            const track = createTrack(context, nextFilmId, audioCue, buffers[index]);
            track.bus.connect(master);
            if (audioCue.mode === "music" && analyserRef.current) {
              track.bus.connect(analyserRef.current);
            }
            const fadeIn = audioCue.mode === "event" ? 0.08 : 0.8;
            track.bus.gain.setValueAtTime(0, now);
            track.bus.gain.linearRampToValueAtTime(audioCue.volume, now + fadeIn);
            tracksRef.current.add(track);
            return track;
          });
          const next: SampleMix = {
            filmId: nextFilmId,
            musicSource: music?.src ?? null,
            effectSources: experience.audio.effects.map(({ src }) => src),
            tracks: nextTracks,
          };
          currentRef.current = next;

          if (previous) {
            previous.tracks.forEach((track) => {
              track.bus.gain.cancelScheduledValues(now);
              track.bus.gain.setValueAtTime(track.bus.gain.value, now);
              track.bus.gain.linearRampToValueAtTime(0, now + 0.65);
            });
            const timer = window.setTimeout(() => {
              previous.tracks.forEach((track) => {
                stopTrack(track);
                tracksRef.current.delete(track);
              });
              timersRef.current.delete(timer);
              reportCurrent(
                contextRef.current?.state === "suspended" ? "suspended" : "running"
              );
            }, 750);
            timersRef.current.add(timer);
          }

          reportCurrent("running");
          return true;
        } catch {
          // Only the live generation may tear down: a stale rejection (film
          // A's buffer fetch failing after film B superseded it) must not
          // close the shared context out from under B.
          if (generation === generationRef.current) stopEverything();
          return false;
        }
      },
      [reportCurrent, stopEverything]
    );

    useEffect(() => {
      // startFilm handles its own failures; a rejection can never escape it.
      if (enabled && filmId) void startFilm(filmId);
      else stopEverything();
    }, [enabled, filmId, startFilm, stopEverything]);

    useEffect(() => {
      // Two independent reasons to go quiet: the tab is hidden, or an embedded
      // scene clip is playing and the score would talk over it. Either one
      // suspends; sound only returns when neither holds. The clip flag lives on
      // a ref so a re-run of this effect mid-clip cannot resume the score over
      // a video that is still playing.
      const applyState = () => {
        const context = contextRef.current;
        if (!enabled || !context || !currentRef.current) return;
        const shouldPlay =
          document.visibilityState !== "hidden" && !clipPlayingRef.current;

        void context[shouldPlay ? "resume" : "suspend"]()
          .then(() => {
            if (contextRef.current === context) {
              reportCurrent(shouldPlay ? "running" : "suspended");
            }
          })
          .catch(() => {
            // A stale context's failure is not the live mix's problem.
            if (contextRef.current === context) stopEverything();
          });
      };

      const onClipPlayback = (event: Event) => {
        const detail = (event as CustomEvent<{ playing?: boolean }>).detail;
        clipPlayingRef.current = Boolean(detail?.playing);
        applyState();
      };

      document.addEventListener("visibilitychange", applyState);
      window.addEventListener(CLIP_PLAYBACK_EVENT, onClipPlayback);
      return () => {
        document.removeEventListener("visibilitychange", applyState);
        window.removeEventListener(CLIP_PLAYBACK_EVENT, onClipPlayback);
      };
    }, [enabled, reportCurrent, stopEverything]);

    useEffect(() => stopEverything, [stopEverything]);

    return null;
}
