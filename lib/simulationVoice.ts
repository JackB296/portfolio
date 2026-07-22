"use client";

// Spoken lines for the simulations.
//
// Every line is a pre-rendered MP3 the owner supplies and the site hosts, keyed
// by a stable id. Nothing is synthesized at runtime and no speech service is
// called, so a visitor's words never leave the page and the audio is identical
// for everyone.
//
// Files live at /public/audio/sim-voice/<id>.mp3. A missing file is not an
// error: `speak` resolves silently, so a game with no audio yet plays exactly
// as it does today. That means voice can land file-by-file.
//
// Licensing note: the shipped lines are rendered locally with macOS's generic
// `Whisper` system voice from text written for this site — no third-party
// service, no free-tier attribution or non-commercial terms, and no sampled
// film dialogue or actor imitation. See docs/assets/film-mode-audio-ledger.md.
// If a line is ever sourced elsewhere, its terms travel with the file: record
// the plan/licence in the ledger before a public deploy.

export const VOICE_BASE = "/audio/sim-voice";

/** Volume per voice character, so one film is never louder than another. */
const VOICE_GAIN = {
  hal: 0.85,
  her: 0.9,
  vk: 0.8,
  matrix: 0.75,
  // The screening-room narrator: the boot greeting and the occasional line
  // that surfaces as you scroll a film's world.
  os: 0.8,
} as const satisfies Record<string, number>;

export type VoiceCharacter = keyof typeof VOICE_GAIN;

type Playing = { audio: HTMLAudioElement; id: string };

let current: Playing | null = null;
/** Ids that 404'd once — never re-requested, so a missing line costs one fetch. */
const missing = new Set<string>();

/** True when the visitor has muted spoken lines for this session. */
let muted = false;

export function setVoiceMuted(next: boolean) {
  muted = next;
  if (next) stopVoice();
}

export function isVoiceMuted() {
  return muted;
}

/** Stop whatever is speaking. Safe to call when nothing is. */
export function stopVoice() {
  if (!current) return;
  current.audio.pause();
  current.audio.src = "";
  current = null;
}

/**
 * Speak one line. Resolves when playback ends — or immediately when the file is
 * absent, the visitor muted voice, or the browser refuses to play, so callers
 * can always `await` without stalling a game on missing audio.
 *
 * Only one line plays at a time: a new line cuts the previous one, which is how
 * a conversation behaves and stops overlapping takes on rapid input.
 */
export function speak(id: string, character: VoiceCharacter = "her"): Promise<void> {
  if (muted || missing.has(id) || typeof window === "undefined") {
    return Promise.resolve();
  }
  stopVoice();

  const audio = new Audio(`${VOICE_BASE}/${encodeURIComponent(id)}.mp3`);
  audio.volume = VOICE_GAIN[character] ?? 0.85;
  audio.preload = "auto";
  const playing: Playing = { audio, id };
  current = playing;

  return new Promise<void>((resolve) => {
    const done = () => {
      if (current === playing) current = null;
      resolve();
    };
    audio.addEventListener("ended", done, { once: true });
    audio.addEventListener(
      "error",
      () => {
        // A line with no recording yet: remember it and stay silent.
        missing.add(id);
        done();
      },
      { once: true }
    );
    // Autoplay policy can reject before any gesture; that is not a failure.
    void audio.play().catch(done);
  });
}

/** Warm the cache for lines a game is about to need. */
export function preloadVoice(ids: readonly string[]) {
  if (typeof window === "undefined" || muted) return;
  for (const id of ids) {
    if (missing.has(id)) continue;
    const audio = new Audio(`${VOICE_BASE}/${encodeURIComponent(id)}.mp3`);
    audio.preload = "auto";
    audio.addEventListener("error", () => missing.add(id), { once: true });
  }
}
