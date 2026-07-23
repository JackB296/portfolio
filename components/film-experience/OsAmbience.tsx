"use client";

import { useEffect, useRef, useState } from "react";
import { commentary } from "@/lib/commentary";
import type { GradeChangeIntent } from "@/lib/grades";
import { isVoiceMuted, speak, stopVoice } from "@/lib/simulationVoice";

// Only Her boots the OS. Committing the Her grade runs a short startup —
// a chime under an "OS initializing / OS complete" readout — then Samantha says
// hello and welcomes you in. From there, scrolling reads each section's
// director's commentary aloud in her voice; a new section cuts off the line
// still speaking. All of it is silent unless Her is committed with sound on and
// no game, launcher, terminal, or theater on screen.

const HER_ID = "her";
const BOOT_CHIME = "/audio/film-modes/os-boot.mp3";
const CHIME_VOLUME = 0.5;
// The theater closes on the same click that commits, so a short beat lets it
// leave before the chime — and confirms no other overlay took its place.
const BOOT_DELAY_MS = 160;
// The readout lingers a moment on "OS complete" before fading out.
const COMPLETE_HOLD_MS = 1_400;

// Reused girl-voice line, then the welcome. Recordings live at
// /public/audio/sim-voice/<id>.mp3; a missing file resolves silently.
const HELLO_LINE = "her-boot-hello-im-here";
const WELCOME_LINE = "her-welcome";

/** section id → the voice id that reads its commentary aloud. */
const NARRATION_ID = (section: string) => `her-narrate-${section}`;
const SECTIONS = commentary.map((entry) => entry.section);

type BootPhase = "idle" | "initializing" | "complete";

type OsAmbienceProps = {
  /** The committed film id, or null for the house. */
  committedFilmId: string | null;
  /** Her's sound toggle. Nothing here plays while it is off. */
  soundEnabled: boolean;
  /** The last grade-change intent, so only a real commit boots — not a hydrate
   * of a persisted grade, nor a hover preview. */
  lastIntent: GradeChangeIntent | "hydrate";
};

/** A game, the launcher, or the terminal is on screen — something to stay quiet
 * under. The film theater is deliberately excluded: committing Her IS what
 * closes it, and its dialog lingers in the DOM through its exit animation past
 * the boot delay, so counting it here would swallow the whole boot every time.
 * By the time the voice lines fire (seconds later) the theater is long gone, so
 * excluding it there is a harmless no-op. */
function overlayOpen() {
  return document.querySelector('[role="dialog"]:not([aria-label="Film theater"])') !== null;
}

/** The written director's-commentary track is on. The spoken narration reads
 * that same track aloud, so it follows the toggle: turning commentary off
 * silences the voice too. CommentaryRoot marks its root with this attribute. */
function commentaryOn() {
  return document.querySelector('[data-commentary="on"]') !== null;
}

export default function OsAmbience({
  committedFilmId,
  soundEnabled,
  lastIntent,
}: OsAmbienceProps) {
  const isHer = committedFilmId === HER_ID;
  const [bootPhase, setBootPhase] = useState<BootPhase>("idle");

  const bootedRef = useRef(false);
  const chimeRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const lastSectionRef = useRef<string | null>(null);
  // Scroll narration stays quiet during the boot greeting; it arms once the
  // welcome line finishes, so the first section (the hero) is read only after
  // the chime and welcome — not on top of them.
  const narrationArmedRef = useRef(false);

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };
  const stopChime = () => {
    if (chimeRef.current) {
      chimeRef.current.pause();
      chimeRef.current.removeAttribute("src");
      chimeRef.current.load();
      chimeRef.current = null;
    }
  };

  // Spoken narration is allowed only with sound armed, voice unmuted, and no
  // overlay covering the page. (The boot chime uses a lighter guard — it is a
  // sound effect, not voice, so muting voice doesn't silence it.)
  const canNarrate = () => soundEnabled && !isVoiceMuted() && !overlayOpen();

  // The boot: chime under the readout, then hello, then the welcome. Once per
  // Her commit, and only for a real commit gesture with sound armed.
  useEffect(() => {
    if (!isHer) {
      // Left Her (or never entered): forget the boot and drop anything live.
      bootedRef.current = false;
      lastSectionRef.current = null;
      narrationArmedRef.current = false;
      clearTimers();
      stopChime();
      stopVoice();
      setBootPhase("idle");
      return;
    }
    if (lastIntent !== "commit" || !soundEnabled || bootedRef.current) return;
    bootedRef.current = true;
    // Suppress scroll narration until the greeting finishes.
    narrationArmedRef.current = false;

    let cancelled = false;
    timersRef.current.push(
      window.setTimeout(() => {
        if (cancelled || !soundEnabled || overlayOpen()) return;
        setBootPhase("initializing");
        const chime = new Audio(BOOT_CHIME);
        chime.volume = CHIME_VOLUME;
        chimeRef.current = chime;
        chime.addEventListener(
          "ended",
          () => {
            if (cancelled) return;
            setBootPhase("complete");
            timersRef.current.push(
              window.setTimeout(() => setBootPhase("idle"), COMPLETE_HOLD_MS)
            );
            if (!canNarrate()) return;
            // Hello, then the welcome, then — once the greeting is done — the
            // narration arms and reads whatever section you're on (the hero,
            // unless you scrolled during boot). Each line cuts the last.
            void speak(HELLO_LINE, "her").then(() => {
              if (cancelled || !canNarrate()) return;
              void speak(WELCOME_LINE, "her").then(() => {
                narrationArmedRef.current = true;
                if (cancelled || !canNarrate() || !commentaryOn()) return;
                const section = lastSectionRef.current ?? SECTIONS[0];
                void speak(NARRATION_ID(section), "her");
              });
            });
          },
          { once: true }
        );
        void chime.play().catch(() => {});
      }, BOOT_DELAY_MS)
    );

    return () => {
      cancelled = true;
    };
  }, [isHer, soundEnabled, lastIntent]);

  // Sound off silences anything in flight at once.
  useEffect(() => {
    if (!soundEnabled) {
      stopChime();
      stopVoice();
      setBootPhase("idle");
    }
  }, [soundEnabled]);

  // Section narration: the commentary for whichever section owns the middle of
  // the viewport is read aloud, and a new section cuts off the previous line
  // (speak() stops what is playing before it starts). Only under Her.
  useEffect(() => {
    if (!isHer) return;

    // If Her is already up without a fresh boot (a reload with the grade
    // persisted), there's no greeting to wait on — arm narration right away.
    if (lastIntent !== "commit") narrationArmedRef.current = true;

    // The active section is the one the viewport's vertical centre line sits
    // within (nearest-centre as a fallback for the gaps between sections). We
    // POLL it on a rAF loop instead of reacting to scroll / IntersectionObserver
    // events: Lenis drives smooth scrolling through its own rAF and does not
    // reliably surface a native scroll event at the instant a section becomes
    // centred, which is why scrolling back up left the previous section's line
    // playing instead of switching to the one you rose to. Polling tracks the
    // centre in both directions however the scroll is driven; `syncActive` only
    // acts when the section actually changes, so it stays cheap. The active id is
    // mirrored onto <html> (data-os-section) so the behaviour is observable.
    // Resolve the section elements FRESH each poll rather than caching them at
    // effect start: on a fresh Her commit the hero swaps its backdrop and the
    // section nodes can be momentarily unresolvable, which used to drop them
    // (notably "top") from a cached list for the whole session — so returning to
    // them never re-narrated.
    const pickActive = () => {
      const mid = window.innerHeight / 2;
      let nearest: string | null = null;
      let best = Infinity;
      for (const id of SECTIONS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= mid && rect.bottom > mid) return id;
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        const distance = Math.abs(rect.top + rect.height / 2 - mid);
        if (distance < best) {
          best = distance;
          nearest = id;
        }
      }
      return nearest;
    };

    const syncActive = () => {
      const section = pickActive();
      if (!section) return;
      // Mirror the active section for observers independent of the narration
      // change-check below: this effect can re-run (e.g. sound toggling on right
      // after commit) and must restore the marker even when the section itself
      // has not changed.
      if (document.documentElement.dataset.osSection !== section) {
        document.documentElement.dataset.osSection = section;
      }
      if (section === lastSectionRef.current) return;
      // Track the current section even while the greeting suppresses narration,
      // so the post-welcome line reads wherever you actually are.
      lastSectionRef.current = section;
      if (!narrationArmedRef.current) return;
      if (!canNarrate() || !commentaryOn()) return;
      void speak(NARRATION_ID(section), "her");
    };

    let rafId = 0;
    const tick = () => {
      syncActive();
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      delete document.documentElement.dataset.osSection;
    };
  }, [isHer, soundEnabled, lastIntent]);

  useEffect(
    () => () => {
      clearTimers();
      stopChime();
      stopVoice();
    },
    []
  );

  if (!isHer || bootPhase === "idle") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-4 left-1/2 z-[45] -translate-x-1/2 rounded-md border border-accent/40 bg-ink/85 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-accent shadow-xl shadow-black/40 backdrop-blur-sm"
    >
      {bootPhase === "initializing" ? (
        <span>
          OS initializing<span className="animate-pulse">…</span>
        </span>
      ) : (
        <span>OS complete</span>
      )}
    </div>
  );
}
