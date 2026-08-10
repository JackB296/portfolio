// The guest terminal's command engine: pure functions from an input line to
// output lines + an optional action for the component to execute. Command
// targets come from the existing registries (case studies, demos, films), so
// the terminal can never drift from the site it navigates. The same
// registries generate a small virtual filesystem — one .txt of raw data per
// case study, demo, and film — that `cd`/`ls`/`cat` walk.

import { caseStudies } from "./caseStudies";
import { demoHref, demos } from "./demos";
import { films, HOUSE_ID } from "./films";
import { profile } from "./data";

/** Anyone can ask the terminal to open (the navbar button, future eggs). */
export const TERMINAL_OPEN_EVENT = "terminal-open";

/** The directories of the virtual filesystem; "~" is home. */
export type TerminalDir = "~" | "work" | "demos" | "films";

export type TerminalAction =
  | Readonly<{ kind: "navigate"; href: string }>
  | Readonly<{ kind: "theme"; gradeId: string | null }>
  | Readonly<{ kind: "cd"; dir: TerminalDir }>
  | Readonly<{ kind: "clear" }>
  | Readonly<{ kind: "exit" }>;

export type TerminalResult = Readonly<{
  lines: readonly string[];
  action?: TerminalAction;
}>;

/**
 * Ambient facts a command may read: the working directory, the active grade,
 * the session history, the window's character grid, and an injectable clock.
 * Everything is optional so the engine stays callable (and testable) with no
 * component.
 */
export type TerminalContext = Readonly<{
  cwd?: TerminalDir;
  gradeId?: string | null;
  history?: readonly string[];
  cols?: number;
  rows?: number;
  now?: Date;
}>;

const LS_DIRS = ["work/", "demos/", "films/"] as const;
const BARE_DIRS = ["work", "demos", "films"] as const;

const workSlugs = caseStudies.map((study) => study.slug);
const demoSlugs = demos.map((demo) => demo.slug);
const filmIds = films.map((film) => film.id);

const columns = (items: readonly string[]) => items.join("  ");

export const WELCOME_LINES: readonly string[] = [
  "Last login: just now on ttys001",
  "jbialecki.com guest shell — type `help` for commands, `exit` to close",
];

const HELP_LINES: readonly string[] = [
  "commands:",
  "  help                 this list",
  "  whoami · pwd · hostname · uname · date",
  "  cd <dir>             step into a folder (`cd ..` climbs back)",
  "  ls [-a] [dir]        list what's here",
  "  cat <file>           print a file's raw data",
  "  open <case-study>    read a work write-up",
  "  play <demo>          launch an interactive demo",
  "  theme <film|house>   re-grade the site for real",
  "  neofetch             system info, terminal style",
  "  echo <text> · history · man <command>",
  "  resume · credits · konami",
  "  clear · exit",
];

// ---------------------------------------------------------------------------
// The virtual filesystem. Every entry is generated from the live registries,
// so the raw data can never drift from what the site actually renders.

type CaseStudy = (typeof caseStudies)[number];
type Demo = (typeof demos)[number];
type Film = (typeof films)[number];

const caseStudyTxt = (s: CaseStudy): readonly string[] => [
  `# ${s.company} — ${s.cardName}`,
  `slug: ${s.slug}`,
  `role: ${s.role}`,
  `period: ${s.period}`,
  `location: ${s.location}`,
  `tags: ${s.tags.join(", ")}`,
  "",
  "## headline",
  s.headline,
  "",
  "## summary",
  s.summary,
  "",
  "## problem",
  ...s.problem.map((p) => `- ${p}`),
  "",
  "## approach",
  ...s.approach.flatMap((a) => [`- ${a.title}`, `  ${a.body}`]),
  "",
  "## stack",
  ...s.stack.map((g) => `${g.group}: ${g.items.join(", ")}`),
  ...(s.outcomes
    ? ["", "## outcomes", ...s.outcomes.map((o) => `${o.metric} ${o.label}`)]
    : []),
  ...(s.highlights
    ? ["", "## highlights", ...s.highlights.map((h) => `- ${h}`)]
    : []),
  "",
  `full write-up: \`open ${s.slug}\``,
];

const demoTxt = (d: Demo): readonly string[] => [
  `# ${d.title} ${d.titleAccent}`,
  `slug: ${d.slug}`,
  `route: ${demoHref(d.slug)}`,
  `category: ${d.accentLabel}`,
  `tags: ${d.tags.join(", ")}`,
  "",
  "## about",
  d.blurb,
  ...(d.home ? ["", "## home card", d.home.blurb] : []),
  "",
  "## code",
  d.github ? `source: ${d.github}` : "source: private repo — ask me about it",
  `run it here: \`play ${d.slug}\``,
];

const stars = (rating: number) =>
  "★".repeat(Math.floor(rating)) + (rating % 1 ? "½" : "");

const filmTxt = (f: Film): readonly string[] => [
  `# ${f.film} (${f.year})`,
  `id: ${f.id}`,
  `vibe: ${f.grade.vibe}`,
  `rating: ${stars(f.review.rating)} (${f.review.rating}/5)`,
  "",
  "## review",
  f.review.body,
  "",
  "## grade (rgb custom properties)",
  `accent: ${f.grade.accent} · bright: ${f.grade.accentBright} · dim: ${f.grade.accentDim}`,
  `ink: ${f.grade.ink} · soft: ${f.grade.inkSoft} · card: ${f.grade.inkCard}`,
  `grain: ${f.grade.grain ?? 0.035} · typeface: ${
    f.grade.fontDisplay?.split(",")[0].replace(/['"]/g, "").replace("var(--font-pixel-base)", "departure mono").replace("var(--font-mono)", "jetbrains mono") ?? "house pixel"
  }`,
  "",
  "## experience",
  `label: ${f.experience.label}`,
  `signature: ${f.experience.signature}`,
  `markers: ${f.experience.markers.join(", ")}`,
  `motion: ${f.experience.tokens.motion} · radius: ${f.experience.tokens.radius}`,
  "",
  "## audio",
  f.experience.audio.music
    ? `music: ${f.experience.audio.music.label} (${f.experience.audio.music.src})`
    : "music: none",
  ...f.experience.audio.effects.map((e) => `effect: ${e.label} (${e.src})`),
  "",
  `wear it: \`theme ${f.id}\``,
];

const VFS: Record<TerminalDir, Record<string, readonly string[]>> = {
  "~": {
    ".plan": [
      "take over the world",
      "become a ceo of a compnay that actually does something. not just AI slop",
      "help my friends and family succeed with me",
    ],
    "readme.md": [
      "# jbialecki.com",
      "my personal portfolio.",
      "`cd work/` for case studies, `cd demos/` for toys, `cd films/` for grades.",
      "`cat <file>` prints the raw data behind each page.",
    ],
  },
  work: Object.fromEntries(
    caseStudies.map((s) => [`${s.slug}.txt`, caseStudyTxt(s)])
  ),
  demos: Object.fromEntries(demos.map((d) => [`${d.slug}.txt`, demoTxt(d)])),
  films: Object.fromEntries(films.map((f) => [`${f.id}.txt`, filmTxt(f)])),
};

type ResolvedPath =
  | Readonly<{ kind: "dir"; dir: TerminalDir }>
  | Readonly<{ kind: "file"; dir: TerminalDir; name: string }>;

/**
 * Resolve a path string against the working directory. Supports "~"-anchored
 * paths, "..", ".", and dir/file forms; returns null for paths that descend
 * through a file. Existence of the final file is the caller's concern.
 */
function resolvePath(cwd: TerminalDir, raw: string): ResolvedPath | null {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "~") {
    return { kind: "dir", dir: trimmed === "" ? cwd : "~" };
  }
  const anchored = trimmed.startsWith("~");
  const segments = trimmed
    .split("/")
    .filter((seg) => seg !== "" && seg !== "." && seg !== "~");
  let dir: TerminalDir = anchored ? "~" : cwd;
  let file: string | null = null;
  for (const seg of segments) {
    if (file !== null) return null;
    if (seg === "..") {
      dir = "~";
      continue;
    }
    if (dir === "~" && (BARE_DIRS as readonly string[]).includes(seg)) {
      dir = seg as TerminalDir;
      continue;
    }
    file = seg;
  }
  return file === null ? { kind: "dir", dir } : { kind: "file", dir, name: file };
}

const ENV: Record<string, string> = {
  USER: "guest",
  HOME: "/Users/guest",
  SHELL: "/bin/guest-sh",
  HOSTNAME: "jbialecki.com",
};

const MAN_PAGES: Record<string, readonly string[]> = {
  help: ["help — list every command the guest shell knows."],
  whoami: ["whoami — print the effective user. spoiler: guest."],
  pwd: ["pwd — print working directory. you live in /Users/guest now."],
  hostname: ["hostname — print the name of this host."],
  uname: ["uname [-a] — print system information."],
  date: ["date — print the current date and time."],
  cd: ["cd <dir> — step into work/, demos/, or films/. `cd ..` climbs back."],
  ls: ["ls [-a] [dir] — list a directory. -a reveals the dotfiles."],
  cat: ["cat <file> — print a file's raw data. every page here has one."],
  open: ["open <case-study> — navigate to a work write-up. see `ls work/`."],
  play: ["play <demo> — launch an interactive demo. see `ls demos/`."],
  theme: ["theme <film|house> — re-grade the entire site to a film's palette."],
  neofetch: ["neofetch — system information, terminal-rice style."],
  echo: ["echo <text> — print text. expands $USER, $HOME, $SHELL, $HOSTNAME."],
  history: ["history — numbered list of everything you've typed this session."],
  man: ["man <command> — read the manual. very meta of you."],
  resume: ["resume — fetch the formal version of all this."],
  credits: ["credits — who scored the films."],
  konami: ["konami — you already know."],
  clear: ["clear — wipe the scrollback. Ctrl+L works too."],
  exit: ["exit — close the terminal. the red light also works."],
};

function ls(args: readonly string[], ctx: TerminalContext): TerminalResult {
  const all = args.some((a) => /^-\w*a/.test(a));
  const target = args.find((a) => !a.startsWith("-"));
  const cwd = ctx.cwd ?? "~";
  const resolved =
    target === undefined
      ? ({ kind: "dir", dir: cwd } as const)
      : resolvePath(cwd, target);
  if (!resolved) return { lines: [`ls: no such directory: ${target}`] };
  if (resolved.kind === "file") {
    return VFS[resolved.dir][resolved.name]
      ? { lines: [resolved.name] }
      : { lines: [`ls: no such file or directory: ${target}`] };
  }
  if (resolved.dir === "~") {
    const names = Object.keys(VFS["~"]).filter(
      (name) => all || !name.startsWith(".")
    );
    return {
      lines: [
        columns([...names, ...LS_DIRS]),
        "try `cd work/`, `cd demos/`, or `cd films/`",
      ],
    };
  }
  return {
    lines: [
      columns(Object.keys(VFS[resolved.dir])),
      "try `cat <file>` — or `cd ..` to climb back",
    ],
  };
}

function cd(raw: string | undefined, ctx: TerminalContext): TerminalResult {
  const resolved =
    raw === undefined
      ? ({ kind: "dir", dir: "~" } as const)
      : resolvePath(ctx.cwd ?? "~", raw);
  if (!resolved) return { lines: [`cd: no such directory: ${raw}`] };
  if (resolved.kind === "file") {
    return VFS[resolved.dir][resolved.name] ||
      VFS[resolved.dir][`${resolved.name}.txt`]
      ? { lines: [`cd: not a directory: ${raw}`] }
      : { lines: [`cd: no such directory: ${raw}`] };
  }
  return { lines: [], action: { kind: "cd", dir: resolved.dir } };
}

function cat(raw: string | undefined, ctx: TerminalContext): TerminalResult {
  if (!raw) return { lines: ["usage: cat <file> — try `ls`"] };
  const resolved = resolvePath(ctx.cwd ?? "~", raw);
  if (!resolved) return { lines: [`cat: no such file: ${raw}`] };
  if (resolved.kind === "dir") return { lines: [`cat: ${raw}: is a directory`] };
  const dir = VFS[resolved.dir];
  // Forgive a missing extension: `cat matrix` finds matrix.txt.
  const file = dir[resolved.name] ?? dir[`${resolved.name}.txt`];
  if (!file) return { lines: [`cat: no such file: ${raw}`] };
  return { lines: file };
}

function open(slug: string | undefined): TerminalResult {
  if (!slug) return { lines: ["usage: open <case-study> — see `ls work/`"] };
  const study = caseStudies.find((s) => s.slug === slug.replace(/\/$/, ""));
  if (!study) return { lines: [`open: no such case study: ${slug}`] };
  return {
    lines: [`opening ${study.company} — ${study.cardName}…`],
    action: { kind: "navigate", href: `/work/${study.slug}` },
  };
}

function play(slug: string | undefined): TerminalResult {
  if (!slug) return { lines: ["usage: play <demo> — see `ls demos/`"] };
  const demo = demos.find((d) => d.slug === slug.replace(/\/$/, ""));
  if (!demo) return { lines: [`play: no such demo: ${slug}`] };
  return {
    lines: [`loading ${demo.title} ${demo.titleAccent}…`],
    action: { kind: "navigate", href: demoHref(demo.slug) },
  };
}

function theme(id: string | undefined): TerminalResult {
  if (!id) return { lines: ["usage: theme <film|house> — see `ls films/`"] };
  if (id === HOUSE_ID) {
    return {
      lines: ["re-grading… house lights up. emerald restored."],
      action: { kind: "theme", gradeId: null },
    };
  }
  const film = films.find((f) => f.id === id);
  if (!film) return { lines: [`theme: no such film: ${id} — see \`ls films/\``] };
  const flourish =
    film.id === "matrix" ? "wake up, jack." : film.grade.vibe.toLowerCase();
  return {
    lines: [`re-grading site for ${film.film} (${film.year})… ${flourish}`],
    action: { kind: "theme", gradeId: film.id },
  };
}

function echo(args: readonly string[]): TerminalResult {
  let text = args
    .join(" ")
    .replace(/\$(\w+)/g, (match, name: string) => ENV[name.toUpperCase()] ?? match);
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1);
  }
  return { lines: [text] };
}

function date(ctx: TerminalContext): TerminalResult {
  const d = ctx.now ?? new Date();
  const [dow, mon, day, year] = d.toDateString().split(" ");
  return { lines: [`${dow} ${mon} ${day} ${d.toTimeString().slice(0, 8)} ${year}`] };
}

function history(ctx: TerminalContext): TerminalResult {
  const past = ctx.history ?? [];
  if (!past.length) return { lines: ["history: nothing yet — type something."] };
  return {
    lines: past.map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`),
  };
}

function man(name: string | undefined): TerminalResult {
  if (!name) return { lines: ["what manual page do you want?"] };
  const page = MAN_PAGES[name.toLowerCase()];
  if (!page) return { lines: [`no manual entry for ${name}`] };
  return { lines: page };
}

// Pure ASCII on purpose: box-drawing/block glyphs miss from the site's mono
// font and fall back to a different width, staircasing the info column.
const NEOFETCH_ART = [
  "   _ _     ",
  "  (_) |__  ",
  "  | | '_ \\ ",
  "  | | |_) |",
  " _/ |_.__/ ",
  "|__/       ",
] as const;

function neofetch(ctx: TerminalContext): TerminalResult {
  const film = films.find((f) => f.id === ctx.gradeId);
  const info = [
    "guest@jbialecki.com",
    "-------------------",
    "OS: PortfolioOS 2.1 (next 14)",
    "Host: jbialecki.com",
    "Kernel: react 18.3 (app router)",
    "Shell: guest-sh 2.1",
    "Terminal: guest.term",
    `Theme: ${film ? `${film.film} (${film.year})` : "house emerald (default)"}`,
    `Resolution: ${ctx.cols ?? 80}×${ctx.rows ?? 24} cells`,
  ];
  const width = Math.max(...NEOFETCH_ART.map((line) => line.length)) + 3;
  const total = Math.max(NEOFETCH_ART.length, info.length);
  return {
    lines: Array.from({ length: total }, (_, i) =>
      `${(NEOFETCH_ART[i] ?? "").padEnd(width)}${info[i] ?? ""}`.trimEnd()
    ),
  };
}

/** Run one input line. Never throws; unknown input reports itself politely. */
export function runCommand(input: string, ctx: TerminalContext = {}): TerminalResult {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };
  const [cmd, ...args] = trimmed.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "help":
      return { lines: HELP_LINES };
    case "whoami":
      return { lines: ["guest"] };
    case "pwd":
      return {
        lines: [
          `${ENV.HOME}${(ctx.cwd ?? "~") === "~" ? "" : `/${ctx.cwd}`}`,
        ],
      };
    case "hostname":
      return { lines: [ENV.HOSTNAME] };
    case "uname":
      return {
        lines: [
          args[0] === "-a"
            ? "PortfolioOS jbialecki.com 2.1.0 GUEST_RELEASE_ARM64 next-14 arm64"
            : "PortfolioOS",
        ],
      };
    case "date":
      return date(ctx);
    case "cd":
      return cd(args[0], ctx);
    case "ls":
      return ls(args, ctx);
    case "cat":
      return cat(args[0], ctx);
    case "open":
      return open(args[0]);
    case "play":
      return play(args[0]);
    case "theme":
      return theme(args[0]);
    case "neofetch":
      return neofetch(ctx);
    case "echo":
      return echo(args);
    case "history":
      return history(ctx);
    case "man":
      return man(args[0]);
    case "resume":
      return {
        lines: ["fetching the formal version…"],
        action: { kind: "navigate", href: profile.resume },
      };
    case "credits":
      return {
        lines: ["rolling credits…"],
        action: { kind: "navigate", href: "/film-credits" },
      };
    case "konami":
      return {
        lines: ["↑↑↓↓←→←→BA — the only winning move is to play."],
        action: { kind: "navigate", href: "/flappy" },
      };
    case "clear":
      return { lines: [], action: { kind: "clear" } };
    case "exit":
      return { lines: ["goodbye."], action: { kind: "exit" } };
    case "rm":
      return {
        lines: ["nice try. this site is version-controlled and, frankly, loved."],
      };
    case "sudo":
      if (args.join(" ").toLowerCase() === "hire jack") {
        return {
          lines: [
            "permission granted. drafting offer letter…",
            "see `resume` for terms.",
          ],
        };
      }
      return { lines: ["guest is not in the sudoers file. this incident will be reported."] };
    default:
      return { lines: [`command not found: ${cmd} — try \`help\``] };
  }
}

const COMMAND_NAMES = [
  "cat",
  "cd",
  "clear",
  "credits",
  "date",
  "echo",
  "exit",
  "help",
  "history",
  "hostname",
  "konami",
  "ls",
  "man",
  "neofetch",
  "open",
  "play",
  "pwd",
  "resume",
  "theme",
  "uname",
  "whoami",
] as const;

/**
 * Filesystem-aware completion candidates for one path argument. Handles both
 * bare names ("rea" → readme.md) and dir-prefixed paths ("work/vo" →
 * "work/voyage-….txt"); returned candidates always extend the argument.
 */
function pathCompletions(arg: string, cwd: TerminalDir): readonly string[] {
  const slash = arg.lastIndexOf("/");
  if (slash === -1) {
    const local = Object.keys(VFS[cwd]);
    const dirs = cwd === "~" ? LS_DIRS : (["../"] as const);
    return [...dirs, ...local].filter((c) => c.startsWith(arg));
  }
  const prefix = arg.slice(0, slash);
  const partial = arg.slice(slash + 1);
  const resolved = resolvePath(cwd, prefix);
  if (!resolved || resolved.kind !== "dir") return [];
  const pool =
    resolved.dir === "~"
      ? [...LS_DIRS, ...Object.keys(VFS["~"])]
      : Object.keys(VFS[resolved.dir]);
  return pool
    .filter((c) => c.startsWith(partial))
    .map((c) => `${prefix}/${c}`);
}

/** Tab completion: candidates for the current input. */
export function completions(
  input: string,
  cwd: TerminalDir = "~"
): readonly string[] {
  const parts = input.trimStart().split(/\s+/);
  const [cmd, arg] = parts;

  // Completing the command word itself.
  if (parts.length <= 1) {
    return COMMAND_NAMES.filter((name) => name.startsWith((cmd ?? "").toLowerCase()));
  }

  const pool = (() => {
    switch (cmd.toLowerCase()) {
      case "ls":
      case "cat":
        return pathCompletions(arg ?? "", cwd);
      case "cd":
        return pathCompletions(arg ?? "", cwd).filter((c) => c.endsWith("/"));
      case "open":
        return workSlugs;
      case "play":
        return demoSlugs;
      case "theme":
        return [HOUSE_ID, ...filmIds];
      case "man":
        return COMMAND_NAMES as readonly string[];
      default:
        return [];
    }
  })();
  return pool.filter((candidate) => candidate.startsWith(arg ?? ""));
}

/** Complete `input` against its candidates; null when nothing (or too much) matches. */
export function completeLine(
  input: string,
  cwd: TerminalDir = "~"
): string | null {
  const matches = completions(input, cwd);
  if (matches.length !== 1) return null;
  const parts = input.trimStart().split(/\s+/);
  parts[parts.length - 1] = matches[0];
  return parts.join(" ");
}

/**
 * The fish-style ghost suggestion for the current input: the most recent
 * history line that extends it, else the first completion candidate. Always
 * returns a full line strictly extending `input`, or null.
 */
export function suggest(
  input: string,
  history: readonly string[],
  cwd: TerminalDir = "~"
): string | null {
  if (!input.trim()) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].startsWith(input) && history[i] !== input) return history[i];
  }
  const matches = completions(input, cwd);
  if (!matches.length) return null;
  const parts = input.trimStart().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const candidate = matches.find((m) => m.startsWith(last));
  if (!candidate) return null;
  parts[parts.length - 1] = candidate;
  const line = parts.join(" ");
  return line.startsWith(input) && line !== input ? line : null;
}
