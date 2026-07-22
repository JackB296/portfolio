"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeLine,
  completions,
  runCommand,
  suggest,
  TERMINAL_OPEN_EVENT,
  type TerminalDir,
  WELCOME_LINES,
} from "@/lib/terminal";
import {
  commitGrade,
  getGrade,
  GRADE_EVENT,
  type GradeChangeDetail,
} from "@/lib/grades";
import { films, HOUSE_ID } from "@/lib/films";

type Entry = Readonly<{
  /** The echoed input line; welcome/system lines have no prompt. */
  prompt?: string;
  /** The directory the command ran in, so past prompts keep their path. */
  dir?: TerminalDir;
  lines: readonly string[];
}>;

/** The path segment shown in the prompt for a directory ("" at home). */
const promptPath = (dir: TerminalDir) => (dir === "~" ? "" : `/${dir}`);

type Frame = Readonly<{ x: number; y: number; w: number; h: number }>;

const HISTORY_KEY = "terminal-history";
const WINDOW_KEY = "terminal-window";
const HISTORY_MAX = 100;
const MIN_W = 320;
const MIN_H = 220;
/** Approximate cell metrics of the 13px mono scrollback, for the title bar
 * grid readout and neofetch. Close is fine; nothing layouts off these. */
const CHAR_W = 7.83;
const LINE_H = 20;
/** Vertical chrome around the scrollback: title bar + body padding. */
const CHROME_H = 76;

const clampFrame = (f: Frame, vw: number, vh: number): Frame => {
  const w = Math.min(Math.max(f.w, MIN_W), Math.max(MIN_W, vw - 16));
  const h = Math.min(Math.max(f.h, MIN_H), Math.max(MIN_H, vh - 16));
  const x = Math.min(Math.max(f.x, 8), Math.max(8, vw - w - 8));
  const y = Math.min(Math.max(f.y, 8), Math.max(8, vh - h - 8));
  return { x, y, w, h };
};

const defaultFrame = (): Frame => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(672, vw - 16);
  const h = Math.min(460, vh - 96);
  return { x: Math.max(8, (vw - w) / 2), y: Math.max(12, vh * 0.08), w, h };
};

const readStoredFrame = (): Frame | null => {
  try {
    const raw = localStorage.getItem(WINDOW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Frame>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.w !== "number" ||
      typeof parsed.h !== "number"
    ) {
      return null;
    }
    return { x: parsed.x, y: parsed.y, w: parsed.w, h: parsed.h };
  } catch {
    return null;
  }
};

const readStoredHistory = (): readonly string[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * The guest terminal: a summonable macOS-style shell window over the site.
 * Backquote (`/~) opens it anywhere text isn't being typed; the navbar's `>_`
 * button dispatches TERMINAL_OPEN_EVENT for discoverability and touch
 * screens. Non-modal: the site stays scrollable behind it, and the window
 * drags by its title bar, resizes from the corner, minimizes to a dock pill,
 * and zooms via the traffic lights. Commands resolve through lib/terminal.ts
 * against the real registries — `theme` (and the title-bar profile picker)
 * commits an actual grade, `open`/`play` really navigate. The prompt and
 * accent text follow the active film grade through the site's CSS variables.
 */
export default function GuestTerminal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<readonly string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [cwd, setCwd] = useState<TerminalDir>("~");

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const minimizedRef = useRef(minimized);
  const frameRef = useRef<Frame | null>(frame);
  openRef.current = open;
  minimizedRef.current = minimized;
  frameRef.current = frame;

  const dragRef = useRef<{
    mode: "drag" | "resize";
    startX: number;
    startY: number;
    origin: Frame;
  } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setMinimized(false);
    setMaximized(false);
  }, []);

  const persistFrame = (f: Frame | null) => {
    try {
      if (f) localStorage.setItem(WINDOW_KEY, JSON.stringify(f));
    } catch {
      // Private browsing can block storage; the session still works.
    }
  };

  const openTerminal = useCallback(() => {
    if (!frameRef.current) {
      const stored = readStoredFrame();
      const next = clampFrame(
        stored ?? defaultFrame(),
        window.innerWidth,
        window.innerHeight
      );
      setFrame(next);
    }
    setOpen(true);
    setMinimized(false);
  }, []);

  // Summon: backquote key (unless typing somewhere real) or the open event.
  // While open, backquote restores a minimized window before it closes one.
  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "`" && event.key !== "~") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;
      event.preventDefault();
      if (!openRef.current) openTerminal();
      else if (minimizedRef.current) setMinimized(false);
      else close();
    };
    const onOpenEvent = () => openTerminal();
    window.addEventListener("keydown", onKey);
    window.addEventListener(TERMINAL_OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(TERMINAL_OPEN_EVENT, onOpenEvent);
    };
  }, [openTerminal, close]);

  // Load persisted history once; follow the active grade for the profile
  // picker and themed output.
  useEffect(() => {
    setHistory(readStoredHistory());
    setGradeId(document.documentElement.dataset.grade ?? null);
    const onGrade = (event: Event) => {
      setGradeId((event as CustomEvent<GradeChangeDetail>).detail.gradeId);
    };
    window.addEventListener(GRADE_EVENT, onGrade);
    return () => window.removeEventListener(GRADE_EVENT, onGrade);
  }, []);

  // Fresh session each open: welcome banner, empty input, normal window state.
  useEffect(() => {
    if (!open) return;
    setEntries([{ lines: WELCOME_LINES }]);
    setInput("");
    setHistoryIndex(null);
    setMaximized(false);
    setCwd("~");
  }, [open]);

  // Focus the prompt whenever the window is (re)shown.
  useEffect(() => {
    if (!open || minimized) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, minimized]);

  // Keep the newest line visible.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  // Keep the window on screen when the viewport shrinks.
  useEffect(() => {
    const onResize = () => {
      setFrame((f) =>
        f ? clampFrame(f, window.innerWidth, window.innerHeight) : f
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const beginPointer = (
    event: React.PointerEvent<HTMLElement>,
    mode: "drag" | "resize"
  ) => {
    if (maximized) return;
    if (event.button !== 0) return;
    if (
      mode === "drag" &&
      (event.target as HTMLElement).closest("button, select")
    ) {
      return;
    }
    const origin = frameRef.current;
    if (!origin) return;
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
    event.preventDefault();
  };

  const movePointer = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setFrame(
      clampFrame(
        drag.mode === "drag"
          ? { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy }
          : {
              ...drag.origin,
              w: drag.origin.w + dx,
              h: drag.origin.h + dy,
            },
        vw,
        vh
      )
    );
  };

  const endPointer = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.style.userSelect = "";
    persistFrame(frameRef.current);
  };

  const cols = frame ? Math.max(20, Math.floor((frame.w - 32) / CHAR_W)) : 80;
  const rows = frame
    ? Math.max(5, Math.floor((frame.h - CHROME_H) / LINE_H))
    : 24;

  const submit = () => {
    const line = input;
    setInput("");
    setHistoryIndex(null);
    const nextHistory = line.trim()
      ? [...history, line].slice(-HISTORY_MAX)
      : history;
    if (nextHistory !== history) {
      setHistory(nextHistory);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      } catch {
        // Storage may be blocked; history just won't survive the reload.
      }
    }

    const result = runCommand(line, {
      cwd,
      gradeId,
      history: nextHistory,
      cols,
      rows,
    });
    const echoed: Entry = { prompt: line, dir: cwd, lines: result.lines };

    switch (result.action?.kind) {
      case "clear":
        setEntries([{ lines: WELCOME_LINES }]);
        return;
      case "exit":
        setEntries((current) => [...current, echoed]);
        close();
        return;
      case "cd":
        setCwd(result.action.dir);
        setEntries((current) => [...current, echoed]);
        return;
      case "theme":
        commitGrade(getGrade(result.action.gradeId) ?? null);
        setEntries((current) => [...current, echoed]);
        return;
      case "navigate": {
        const href = result.action.href;
        setEntries((current) => [...current, echoed]);
        close();
        router.push(href);
        return;
      }
      default:
        setEntries((current) => [...current, echoed]);
    }
  };

  const ghost = suggest(input, history, cwd);
  const ghostSuffix =
    ghost && ghost.startsWith(input) ? ghost.slice(input.length) : "";

  const acceptGhost = (): boolean => {
    if (!ghost || ghost === input) return false;
    setInput(ghost);
    return true;
  };

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const el = event.currentTarget;
    if (event.ctrlKey && (event.key === "l" || event.key === "L")) {
      event.preventDefault();
      setEntries([{ lines: WELCOME_LINES }]);
      return;
    }
    if (
      event.ctrlKey &&
      (event.key === "c" || event.key === "C") &&
      el.selectionStart === el.selectionEnd
    ) {
      event.preventDefault();
      setEntries((current) => [...current, { prompt: `${input}^C`, lines: [] }]);
      setInput("");
      setHistoryIndex(null);
      return;
    }
    if (event.ctrlKey && (event.key === "u" || event.key === "U")) {
      event.preventDefault();
      setInput("");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const completed = completeLine(input, cwd);
      if (completed != null) {
        setInput(completed);
        return;
      }
      if (acceptGhost()) return;
      const matches = completions(input, cwd);
      if (matches.length > 1) {
        setEntries((current) => [...current, { lines: [matches.join("  ")] }]);
      }
      return;
    }
    if (event.key === "ArrowRight" || event.key === "End") {
      if (el.selectionStart === input.length && acceptGhost()) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!history.length) return;
      const next =
        historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    }
  };

  const windowStyle = maximized
    ? {
        left: 12,
        top: 12,
        width: "calc(100vw - 24px)",
        height: "calc(100vh - 24px)",
      }
    : frame
      ? { left: frame.x, top: frame.y, width: frame.w, height: frame.h }
      : undefined;

  return (
    <div data-terminal={open ? "open" : "closed"}>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Guest terminal"
          style={windowStyle}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className={`fixed z-[71] flex flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#1e1e1e] shadow-2xl shadow-black/60 ${
            minimized ? "hidden" : ""
          }`}
        >
          {/* Title bar: traffic lights, session title, profile picker. */}
          <div
            data-terminal-titlebar
            onPointerDown={(event) => beginPointer(event, "drag")}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            className="flex flex-none cursor-grab touch-none select-none items-center gap-3 border-b border-black/40 bg-[#2d2d2f] px-3 py-2 active:cursor-grabbing"
          >
            <div className="group flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={close}
                aria-label="Close terminal"
                className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] text-[9px] font-bold leading-none text-transparent transition-colors group-hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ×
              </button>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimize terminal"
                className="flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] text-[9px] font-bold leading-none text-transparent transition-colors group-hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setMaximized((m) => !m)}
                aria-label="Zoom terminal"
                className="flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] text-[9px] font-bold leading-none text-transparent transition-colors group-hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                +
              </button>
            </div>
            <span className="min-w-0 flex-1 truncate text-center text-[11px] text-white/40">
              guest — jbialecki.com — zsh — {cols}×{rows}
            </span>
            <select
              value={gradeId ?? HOUSE_ID}
              onChange={(event) => {
                const id = event.target.value;
                commitGrade(id === HOUSE_ID ? null : getGrade(id) ?? null);
                inputRef.current?.focus();
              }}
              aria-label="Terminal profile"
              className="flex-none cursor-pointer rounded border-none bg-[#3a3a3c] px-1.5 py-0.5 text-[11px] text-white/70 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value={HOUSE_ID}>house</option>
              {films.map((film) => (
                <option key={film.id} value={film.id}>
                  {film.film.toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Scrollback */}
          <div
            ref={scrollRef}
            onClick={() => {
              if (window.getSelection()?.isCollapsed) inputRef.current?.focus();
            }}
            // The terminal is non-modal, so the site keeps scrolling behind it —
            // but a wheel over the scrollback belongs to the scrollback.
            // data-lenis-prevent keeps the smooth-scroll engine out of here, and
            // overscroll-contain stops the page taking over at either end.
            data-lenis-prevent
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 font-mono text-[13px] leading-relaxed"
            data-terminal-output
          >
            {entries.map((entry, i) => (
              <div key={i}>
                {entry.prompt !== undefined && (
                  <div className="text-white/90">
                    <span className="text-accent">guest@jbialecki</span>
                    <span className="text-white/40">
                      {" "}~{promptPath(entry.dir ?? "~")} %{" "}
                    </span>
                    {entry.prompt}
                  </div>
                )}
                {entry.lines.map((line, j) => (
                  <div key={j} className="whitespace-pre-wrap text-white/75">
                    {line}
                  </div>
                ))}
              </div>
            ))}

            {/* Prompt line with the ghost suggestion behind the input. */}
            <div className="flex items-center gap-2">
              <span className="flex-none">
                <span className="text-accent">guest@jbialecki</span>
                <span className="text-white/40"> ~{promptPath(cwd)} %</span>
              </span>
              <div className="relative min-w-0 flex-1">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value);
                    setHistoryIndex(null);
                  }}
                  onKeyDown={onInputKey}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  aria-label="Terminal command"
                  className="relative z-[1] w-full bg-transparent text-white/90 caret-accent outline-none placeholder:text-white/25"
                  placeholder={input ? undefined : "help"}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-white/30"
                >
                  <span className="invisible">{input}</span>
                  <span data-terminal-ghost>{ghostSuffix}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resize grip */}
          {!maximized && (
            <div
              data-terminal-resize
              onPointerDown={(event) => beginPointer(event, "resize")}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              aria-hidden
              className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
            />
          )}
        </div>
      )}

      {/* Minimized dock pill */}
      {open && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Restore terminal"
          className="fixed bottom-4 left-1/2 z-[71] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#2d2d2f] px-4 py-2 font-mono text-[11px] text-white/70 shadow-xl shadow-black/50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="h-2 w-2 rounded-full bg-[#28c840]" aria-hidden />
          guest — jbialecki.com
        </button>
      )}
    </div>
  );
}
