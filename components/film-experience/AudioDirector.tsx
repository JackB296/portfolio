"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { filmExperienceById } from "@/lib/filmExperiences";
import type { AudioCueDefinition } from "@/lib/filmExperienceTypes";
import { setMusicAnalyser } from "./shared";

export type AudioDirectorStatus = Readonly<{
  state: "off" | "running" | "suspended";
  filmId: string | null;
  source: string | null;
  musicSource: string | null;
  effectSources: readonly string[];
  nodeCount: number;
  trackCount: number;
}>;

export type AudioDirectorHandle = {
  enable: (filmId: string | null) => Promise<boolean>;
  disable: () => void;
};

type AudioDirectorProps = {
  filmId: string | null;
  enabled: boolean;
  onStatus: (status: AudioDirectorStatus) => void;
};

type SampleTrack = {
  filmId: string;
  cue: AudioCueDefinition;
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
  musicSource: string;
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
  track.nextTriggerAt =
    context.currentTime + (track.cue.triggerCooldownMs ?? 1_200) / 1_000;
}

function createTrack(
  context: AudioContext,
  filmId: string,
  cue: AudioCueDefinition,
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
    source.start();
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
      velocity >= (track.cue.triggerThreshold ?? 0.3) &&
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
  if (playbackRate && track.cue.scrollRate > 0) {
    scheduleReturn(
      playbackRate,
      now,
      1 + response * track.cue.scrollRate,
      1
    );
  }
}

const offStatus: AudioDirectorStatus = {
  state: "off",
  filmId: null,
  source: null,
  musicSource: null,
  effectSources: [],
  nodeCount: 0,
  trackCount: 0,
};

const AudioDirector = forwardRef<AudioDirectorHandle, AudioDirectorProps>(
  function AudioDirector({ filmId, enabled, onStatus }, ref) {
    const { scrollY } = useScroll();
    const contextRef = useRef<AudioContext | null>(null);
    const masterRef = useRef<GainNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const currentRef = useRef<SampleMix | null>(null);
    const tracksRef = useRef(new Set<SampleTrack>());
    const timersRef = useRef(new Set<number>());
    const bufferCacheRef = useRef(new Map<string, Promise<AudioBuffer>>());
    const generationRef = useRef(0);
    const statusCallbackRef = useRef(onStatus);
    statusCallbackRef.current = onStatus;

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
          source: current?.musicSource ?? null,
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
      report(offStatus);
    }, [report]);

    const startFilm = useCallback(
      async (nextFilmId: string | null) => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        const definition = nextFilmId
          ? filmExperienceById.get(nextFilmId)
          : undefined;
        if (!definition || !nextFilmId) {
          stopEverything();
          return false;
        }

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

        const cues = [definition.audio.music, ...definition.audio.effects];
        const loadBuffer = (audioCue: AudioCueDefinition) => {
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
          musicSource: definition.audio.music.src,
          effectSources: definition.audio.effects.map(({ src }) => src),
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
      },
      [reportCurrent, stopEverything]
    );

    useImperativeHandle(
      ref,
      () => ({ enable: startFilm, disable: stopEverything }),
      [startFilm, stopEverything]
    );

    useEffect(() => {
      if (enabled && filmId) void startFilm(filmId).catch(stopEverything);
    }, [enabled, filmId, startFilm, stopEverything]);

    useEffect(() => {
      const onVisibilityChange = () => {
        const context = contextRef.current;
        if (!enabled || !context || !currentRef.current) return;

        if (document.visibilityState === "hidden") {
          void context
            .suspend()
            .then(() => {
              if (contextRef.current === context) reportCurrent("suspended");
            })
            .catch(stopEverything);
          return;
        }

        void context
          .resume()
          .then(() => {
            if (contextRef.current === context) reportCurrent("running");
          })
          .catch(stopEverything);
      };

      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }, [enabled, reportCurrent, stopEverything]);

    useEffect(() => stopEverything, [stopEverything]);

    return null;
  }
);

export default AudioDirector;
