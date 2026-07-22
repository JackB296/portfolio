"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createAudioContext } from "@/lib/filmAudio";
import SimulationShell from "@/components/film-experience/SimulationShell";
import { recordSimulationScore } from "@/lib/simulationScores";
import { useReducedMotion } from "@/lib/useReducedMotion";
import FightClubTouristBoard, { type RoomOwner } from "./FightClubTouristBoard";
import FightClubTouristBreath from "./FightClubTouristBreath";
import {
  BOWEL_INDEX,
  collisionAt,
  COMPOSURE_START,
  LINE_OPTIONS,
  MARLA_BEATS,
  MARLA_CHOICES,
  NIGHTS,
  PUSHBACK,
  ratingFor,
  SCORE_ID,
} from "./FightClubTouristData";
import FightClubTouristStage from "./FightClubTouristStage";

// The tourist's week, staged: seven support groups, each night its own scene —
// pick a name tag the sheet won't contradict, say the line that belongs to
// THIS room, and steady your breath when a regular pries. Marla crashes the
// week after night four; once the last chair folds, the two of you split the
// calendar on a board where her claims are non-negotiable. Mostly. Ten
// composure for the whole week; at zero, the room says it out loud.

type Phase = "briefing" | "night" | "marla" | "negotiation" | "settled" | "made";
type Step = "tag" | "line" | "probe";
type NightResult = Readonly<{ group: string; alias: string; clean: boolean }>;
type Breakdown = Readonly<{ composure: number; perfect: number; firstTry: boolean; honored: boolean }>;

const BUTTON =
  "border border-accent/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-transform hover:bg-accent/10 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const LABEL = "text-[10px] uppercase tracking-[0.18em] text-white/45";

function pushLog(lines: string[], line: string) {
  return [line, ...lines].slice(0, 6);
}

/** Mounts children a beat below and faded, then settles them into place.
 * Skipped entirely under reduced motion. */
function FadeIn({ k, reduced, children }: { k: string; reduced: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    setShown(false);
    const id = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(id);
  }, [k, reduced]);
  return (
    <div
      className={`transition-all duration-300 ${shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
    >
      {children}
    </div>
  );
}

function TouristWeek() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("briefing");
  const [night, setNight] = useState(0);
  const [step, setStep] = useState<Step>("tag");
  const [composure, setComposure] = useState(COMPOSURE_START);
  const [worn, setWorn] = useState<string[]>([]);
  const [nightMistakes, setNightMistakes] = useState(0);
  const [results, setResults] = useState<NightResult[]>([]);
  const [marlaBeat, setMarlaBeat] = useState(0);
  const [assignment, setAssignment] = useState<RoomOwner[]>(() => NIGHTS.map(() => "mine"));
  const [settleTries, setSettleTries] = useState(0);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [log, setLog] = useState<string[]>(["Seven rooms. Seven nights. Don't get made."]);
  const [muted, setMuted] = useState(false);
  const [wrongPick, setWrongPick] = useState<string | null>(null);

  const focusRef = useRef<HTMLButtonElement>(null);
  const wrongTimerRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  const addLog = useCallback((line: string) => setLog((lines) => pushLog(lines, line)), []);

  // ---- Sound: self-rendered oscillator cues, created on gesture, muteable. ----
  const tone = useCallback(
    (freq: number, duration = 0.14, type: OscillatorType = "triangle", peak = 0.06) => {
      if (mutedRef.current) return;
      let ctx = audioRef.current;
      if (!ctx) {
        ctx = createAudioContext();
        if (!ctx) return;
        audioRef.current = ctx;
      }
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    },
    []
  );
  const cueGood = useCallback(() => tone(520, 0.12), [tone]);
  const cueBad = useCallback(() => tone(120, 0.22, "sine", 0.07), [tone]);
  const cueBreath = useCallback(() => tone(660, 0.12), [tone]);
  const cueSting = useCallback(() => tone(196, 0.3, "sawtooth", 0.03), [tone]);
  const cueChord = useCallback(() => {
    tone(392, 0.5);
    tone(494, 0.5);
  }, [tone]);

  // No audio graph or pending flashes outlive the dialog.
  useEffect(() => {
    return () => {
      window.clearTimeout(wrongTimerRef.current);
      const ctx = audioRef.current;
      audioRef.current = null;
      if (ctx && ctx.state !== "closed") void ctx.close();
    };
  }, []);

  // Keyboard flow: each new screen hands focus to its first control. The
  // breath check manages its own focus while it is up.
  useEffect(() => {
    const id = window.setTimeout(() => focusRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [phase, night, step, marlaBeat]);

  // Settled: the score counts up (or lands instantly under reduced motion).
  useEffect(() => {
    if (phase !== "settled") return;
    if (reducedMotion) {
      setDisplayScore(score);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - start) / 900);
      setDisplayScore(Math.round(score * (1 - Math.pow(1 - f, 3))));
      if (f < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, score, reducedMotion]);

  const flashWrong = useCallback((pick: string) => {
    setWrongPick(pick);
    window.clearTimeout(wrongTimerRef.current);
    wrongTimerRef.current = window.setTimeout(() => setWrongPick(null), 400);
  }, []);

  /** Costs composure; flips to "made" at zero. Returns true when it ended you. */
  const lose = useCallback(
    (amount: number, message: string) => {
      const next = composure - amount;
      if (next <= 0) {
        setComposure(0);
        setPhase("made");
        addLog("The room turns. “You're a tourist.”");
        return true;
      }
      setComposure(next);
      addLog(`${message} Composure ${next}/${COMPOSURE_START}.`);
      return false;
    },
    [addLog, composure]
  );

  const begin = useCallback(() => {
    setPhase("night");
    addLog(`Night 1 · ${NIGHTS[0].group}. Sign in and blend.`);
  }, [addLog]);

  const finishNight = useCallback(
    (extraMistake: boolean) => {
      const current = NIGHTS[night];
      const clean = nightMistakes === 0 && !extraMistake;
      setResults((prev) => [
        ...prev,
        { group: current.group, alias: worn[worn.length - 1] ?? "—", clean },
      ]);
      if (clean) addLog("A clean night. You sleep like a baby.");
      if (night === 3) {
        setPhase("marla");
        setMarlaBeat(0);
        cueSting();
        addLog("Then she walks in.");
        return;
      }
      if (night === 6) {
        setPhase("negotiation");
        addLog("Her rooms are marked. Take yours, cede hers. No shared rooms.");
        return;
      }
      setNight(night + 1);
      setStep("tag");
      setNightMistakes(0);
    },
    [addLog, cueSting, night, nightMistakes, worn]
  );

  const pickTag = useCallback(
    (name: string) => {
      if (phase !== "night" || step !== "tag") return;
      const current = NIGHTS[night];
      if (current.sheet.includes(name)) {
        flashWrong(name);
        cueBad();
        setNightMistakes((m) => m + 1);
        lose(1, `“${name}” is already on tonight's sheet.`);
        return;
      }
      if (worn.includes(name)) {
        flashWrong(name);
        cueBad();
        setNightMistakes((m) => m + 1);
        lose(1, `You already spent a night as ${name}.`);
        return;
      }
      cueGood();
      setWorn((prev) => [...prev, name]);
      addLog(`Name tag: ${name}. Nobody looks twice.`);
      setStep("line");
    },
    [addLog, cueBad, cueGood, flashWrong, lose, night, phase, step, worn]
  );

  const pickLine = useCallback(
    (line: string) => {
      if (phase !== "night" || step !== "line") return;
      const current = NIGHTS[night];
      if (line !== current.tell) {
        flashWrong(line);
        cueBad();
        setNightMistakes((m) => m + 1);
        lose(1, "That line belongs to another room.");
        return;
      }
      cueGood();
      addLog(`${current.group} — you blend right in.`);
      if (current.probe) {
        setStep("probe");
        return;
      }
      finishNight(false);
    },
    [addLog, cueBad, cueGood, finishNight, flashWrong, lose, night, phase, step]
  );

  const probeResult = useCallback(
    (steadied: boolean) => {
      if (phase !== "night" || step !== "probe") return;
      if (steadied) {
        cueBreath();
        addLog("You hold it together. The question moves on.");
        finishNight(false);
        return;
      }
      cueBad();
      if (lose(1, "Your breath snags. Eyes linger.")) return;
      finishNight(true);
    },
    [addLog, cueBad, cueBreath, finishNight, lose, phase, step]
  );

  const chooseMarla = useCallback(
    (choice: (typeof MARLA_CHOICES)[number]) => {
      addLog(choice.log);
      setPhase("night");
      setNight(4);
      setStep("tag");
      setNightMistakes(0);
    },
    [addLog]
  );

  const toggleRoom = useCallback(
    (index: number) => {
      if (phase !== "negotiation") return;
      const next: RoomOwner = assignment[index] === "mine" ? "hers" : "mine";
      if (next === "mine" && NIGHTS[index].marla) {
        addLog(PUSHBACK[index]);
        cueSting();
      }
      setAssignment((prev) => {
        const copy = [...prev];
        copy[index] = next;
        return copy;
      });
    },
    [addLog, assignment, cueSting, phase]
  );

  const settle = useCallback(() => {
    if (phase !== "negotiation") return;
    const tries = settleTries + 1;
    setSettleTries(tries);
    const hard = NIGHTS.reduce(
      (count, _room, index) =>
        index === BOWEL_INDEX ? count : count + (collisionAt(assignment, index) ? 1 : 0),
      0
    );
    if (hard > 0) {
      cueBad();
      lose(1, `${hard} room${hard > 1 ? "s" : ""} still collide.`);
      return;
    }
    const keptBowel = assignment[BOWEL_INDEX] === "mine";
    let final = composure;
    if (keptBowel) {
      const pay = Math.min(2, composure - 1);
      final = composure - pay;
      setComposure(final);
      addLog(`You keep bowel cancer. She makes you pay for it. Composure ${final}/${COMPOSURE_START}.`);
    } else {
      addLog("Bowel cancer is hers. The week finally has two names on it.");
    }
    const perfect = results.filter((r) => r.clean).length;
    const total = final * 10 + perfect * 8 + (tries === 1 ? 12 : 0) + (keptBowel ? 0 : 10);
    setBreakdown({ composure: final, perfect, firstTry: tries === 1, honored: !keptBowel });
    setScore(total);
    recordSimulationScore(SCORE_ID, total);
    cueChord();
    setPhase("settled");
  }, [addLog, assignment, composure, cueBad, cueChord, lose, phase, results, settleTries]);

  const restart = useCallback(() => {
    setPhase("night");
    setNight(0);
    setStep("tag");
    setComposure(COMPOSURE_START);
    setWorn([]);
    setNightMistakes(0);
    setResults([]);
    setMarlaBeat(0);
    setAssignment(NIGHTS.map(() => "mine"));
    setSettleTries(0);
    setBreakdown(null);
    setScore(0);
    setDisplayScore(0);
    setWrongPick(null);
    setLog(["Re-checked in. Same rooms, new week."]);
  }, []);

  const current = NIGHTS[night];
  const marlaPresent =
    phase === "marla" || phase === "negotiation" || (phase === "night" && current.postMarla);
  const over = phase === "settled" || phase === "made";

  const status = useMemo(() => {
    if (phase === "briefing") return "Three rules, then the basement.";
    if (phase === "marla") return "The other tourist just walked in.";
    if (phase === "negotiation") return "Split the week. Honor her claims — or pay.";
    if (phase === "settled") return `The week is yours. Score ${score}.`;
    if (phase === "made") return "You got made. No more meetings.";
    const doing =
      step === "tag" ? "pick a name" : step === "line" ? "say the line that blends" : "steady your breath";
    return `Night ${night + 1}/7 · ${current.group} — ${doing}`;
  }, [current.group, night, phase, score, step]);

  const sceneLabel = useMemo(() => {
    if (phase === "briefing") return "Check-in";
    if (phase === "marla") return "Mid-week";
    if (phase === "negotiation") return "The split";
    if (phase === "settled") return "Epilogue";
    if (phase === "made") return "Made";
    return `Night ${night + 1}/7 · ${current.group}`;
  }, [current.group, night, phase]);

  const pickButtonClass = (value: string) =>
    `${BUTTON} text-left normal-case tracking-normal leading-snug text-white/80 ${
      wrongPick === value ? "border-dashed border-white/80 bg-accent/20" : ""
    }`;

  return (
    <div
      data-sim-state={phase}
      data-composure={composure}
      data-night={night + 1}
      data-step={phase === "night" ? step : undefined}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_230px]">
        {/* ---- Scene column ---- */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative h-32 overflow-hidden border border-accent/25 sm:h-44">
            <FightClubTouristStage
              chairs={current.chairs}
              flicker={phase === "made" ? 0.9 : current.flicker}
              marla={marlaPresent}
              composure={composure}
              composureStart={COMPOSURE_START}
              reducedMotion={reducedMotion}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-2 text-[9px] uppercase tracking-[0.18em] text-white/50">
              <span>{sceneLabel}</span>
              {phase === "night" && <span className="text-right">{current.mood}</span>}
            </div>
          </div>

          <div className="min-h-40">
            <FadeIn k={`${phase}-${night}-${step}-${marlaBeat}`} reduced={reducedMotion}>
              {phase === "briefing" && (
                <div className="flex flex-col gap-2 text-[11px] normal-case leading-relaxed text-white/75">
                  <p>Seven meetings in seven nights. Blend in at every one:</p>
                  <p>&middot; Wear a name that isn&rsquo;t on tonight&rsquo;s sheet &mdash; and never the same name twice.</p>
                  <p>&middot; Say the line that belongs to this room, not another.</p>
                  <p>&middot; When a regular pries, breathe, and exhale inside the still band.</p>
                  <p className="text-white/50">
                    Ten composure for the week. Every slip costs one. At zero, you&rsquo;re made.
                  </p>
                  <button ref={focusRef} type="button" onClick={begin} className={`${BUTTON} self-start`}>
                    Walk in
                  </button>
                </div>
              )}

              {phase === "night" && step === "tag" && (
                <div className="flex flex-col gap-2">
                  <p className={LABEL}>On tonight&rsquo;s sheet: {current.sheet.join(" · ")}</p>
                  <p className={LABEL}>Pick a name tag</p>
                  <div className="grid grid-cols-3 gap-2">
                    {current.aliases.map((name, index) => (
                      <button
                        key={name}
                        ref={index === 0 ? focusRef : undefined}
                        type="button"
                        onClick={() => pickTag(name)}
                        className={pickButtonClass(name)}
                      >
                        <span className="block text-[8px] uppercase tracking-[0.2em] text-white/40">
                          hello my name is
                        </span>
                        <span className="mt-0.5 block text-[12px] text-white/90">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {phase === "night" && step === "line" && (
                <div className="flex flex-col gap-2">
                  <p className={LABEL}>Your turn to share</p>
                  <div className="flex flex-col gap-2">
                    {LINE_OPTIONS[night].map((line, index) => (
                      <button
                        key={line}
                        ref={index === 0 ? focusRef : undefined}
                        type="button"
                        onClick={() => pickLine(line)}
                        className={pickButtonClass(line)}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {phase === "night" && step === "probe" && current.probe && (
                <FightClubTouristBreath
                  question={current.probe.question}
                  periodMs={current.probe.periodMs}
                  zone={current.probe.zone}
                  reducedMotion={reducedMotion}
                  onResult={probeResult}
                />
              )}

              {phase === "marla" && (
                <div className="flex flex-col gap-2">
                  {MARLA_BEATS.slice(0, marlaBeat + 1).map((beat) => (
                    <p key={beat} className="text-[11px] normal-case leading-relaxed text-white/85">
                      {beat}
                    </p>
                  ))}
                  {marlaBeat < MARLA_BEATS.length - 1 ? (
                    <button
                      ref={focusRef}
                      type="button"
                      onClick={() => setMarlaBeat((beat) => beat + 1)}
                      className={`${BUTTON} self-start`}
                    >
                      And then
                    </button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {MARLA_CHOICES.map((choice, index) => (
                        <button
                          key={choice.label}
                          ref={index === 0 ? focusRef : undefined}
                          type="button"
                          onClick={() => chooseMarla(choice)}
                          className={BUTTON}
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {phase === "negotiation" && (
                <FightClubTouristBoard
                  assignment={assignment}
                  onToggle={toggleRoom}
                  onSettle={settle}
                  firstChipRef={focusRef}
                />
              )}

              {phase === "settled" && breakdown && (
                <div className="flex flex-col gap-2 text-[11px]">
                  <p className={LABEL}>The week, on paper</p>
                  <ul className="flex flex-col gap-1 normal-case text-white/75">
                    {results.map((result, index) => (
                      <li key={`${result.group}-${index}`} className="flex justify-between gap-3">
                        <span className="truncate">
                          {index + 1}. {result.group} &mdash; as {result.alias}
                        </span>
                        <span className={result.clean ? "text-accent" : "text-white/45"}>
                          {result.clean ? "✓ blended" : "~ wobbled"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-1 flex flex-col gap-0.5 border-t border-white/10 pt-2 text-[10px] uppercase tracking-[0.12em] text-white/55">
                    <p>Composure held &times;10 &rarr; {breakdown.composure * 10}</p>
                    <p>Clean nights &times;8 &rarr; {breakdown.perfect * 8}</p>
                    <p>First-try split {breakdown.firstTry ? "→ +12" : "— missed"}</p>
                    <p>Bowel cancer {breakdown.honored ? "honored → +10" : "kept — paid for"}</p>
                  </div>
                  <p className="mt-1 text-2xl text-accent" data-final-score={score}>
                    Score {displayScore}
                  </p>
                  <p className="italic normal-case text-white/70">{ratingFor(score)}</p>
                </div>
              )}

              {phase === "made" && (
                <div className="flex flex-col gap-2 text-[11px] normal-case leading-relaxed text-white/80">
                  <p>The room turns. &ldquo;You&rsquo;re a tourist.&rdquo;</p>
                  <p className="text-white/55">No more meetings. No more sleep. Check in again and blend better.</p>
                </div>
              )}
            </FadeIn>
          </div>
        </div>

        {/* ---- HUD column ---- */}
        <aside className="flex flex-col gap-3 border border-accent/20 bg-ink/60 p-3">
          <div>
            <p className={LABEL}>Composure</p>
            <div aria-hidden className="mt-1 flex gap-1">
              {Array.from({ length: COMPOSURE_START }).map((_, index) => (
                <span
                  key={index}
                  className={`h-3 w-1.5 transition-all duration-300 ${
                    index < composure ? "bg-accent" : "bg-white/10"
                  } ${composure <= 3 && index < composure ? "animate-pulse" : ""}`}
                />
              ))}
            </div>
            <p className="mt-1 text-[10px] text-white/60">
              {composure}/{COMPOSURE_START}
              {composure <= 3 && composure > 0 && " · fraying"}
            </p>
          </div>
          <div>
            <p className={LABEL}>The week</p>
            <div aria-hidden className="mt-1 flex gap-1">
              {NIGHTS.map((room, index) => (
                <span
                  key={room.group}
                  className={`h-2 w-2 rounded-full border ${
                    index < results.length
                      ? results[index].clean
                        ? "border-accent bg-accent"
                        : "border-accent/60 bg-accent/25"
                      : phase === "night" && index === night
                        ? "border-accent-bright"
                        : "border-white/20"
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 text-[10px] text-white/60">
              {results.length}/7 nights down
            </p>
          </div>
          {worn.length > 0 && (
            <div>
              <p className={LABEL}>Names worn</p>
              <p className="mt-1 text-[10px] normal-case leading-relaxed text-white/60">
                {worn.join(" · ")}
              </p>
            </div>
          )}
          <button
            type="button"
            aria-pressed={muted}
            aria-label="Toggle sound effects"
            onClick={() => {
              mutedRef.current = !mutedRef.current;
              setMuted(mutedRef.current);
            }}
            className="self-start border border-accent/20 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-white/60 hover:bg-accent/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            sfx {muted ? "off" : "on"}
          </button>
          <div className="mt-auto h-24 overflow-hidden border-t border-white/10 pt-2 text-[10px] leading-relaxed">
            {log.map((line, index) => (
              <p key={`${index}-${line}`} className={index === 0 ? "text-accent" : "text-white/40"}>
                {line}
              </p>
            ))}
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.12em]">
        <p role="status" className="text-white/55">
          {status}
        </p>
        {over && (
          <button
            ref={focusRef}
            type="button"
            onClick={restart}
            className="shrink-0 border border-accent/30 px-2 py-1 transition-transform hover:bg-accent/10 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Check in again
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { onClose: () => void };

export default function FightClubTourist({ onClose }: Props) {
  return (
    <SimulationShell
      titleId="fight-club-tourist-title"
      gameId="fight-club-tourist"
      eyebrow="Cover story"
      title="The tourist"
      startLabel="Check in"
      stage
      howToPlay={{
        objective:
          "Blend into seven support groups without burning your ten composure, then split the week with Marla so no room ends up with both your names on it.",
        controls: [
          { keys: "tap a tag", does: "wear a name that isn't on tonight's sheet and that you haven't worn yet" },
          { keys: "tap a line", does: "share the line that belongs to this room, not another" },
          { keys: "Exhale", does: "end a regular's probing question while the needle sits in the still band" },
          { keys: "drag", does: "slide a room across the board to cede that night to marla" },
          { keys: "Tab / Enter", does: "move between the choices and commit one from the keyboard" },
        ],
        tip: "Every slip costs one composure, and at zero the room says it out loud. Settling the board on the first try is worth points, and keeping bowel cancer — her claim — costs composure instead. Under reduced motion the needle stops swinging: a Breathe button steps it, and the readout tells you when you're inside the band.",
      }}
      reference={{
        quote: "You're a tourist.",
        scene: "Fight Club (1999) · seven support groups, and Marla the other faker",
      }}
      onClose={onClose}
    >
      <TouristWeek />
    </SimulationShell>
  );
}
