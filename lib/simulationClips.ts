// The scene each simulation alludes to, shown beside its reference card as the
// official YouTube player.
//
// Why the official embed: the games themselves are original works that only
// allude to a scene. Showing the scene itself is a different act, so it happens
// the one way the rights holder sanctions — YouTube's own embedded player,
// unmodified, from a verified rights-holder upload. The site never hosts,
// copies, crops, covers, autoplays, or strips audio from any clip; it links to
// the same player YouTube serves everywhere else. That is the whole policy:
// visible standard player, no background or audio-only playback.
//
// The privacy-enhanced host (youtube-nocookie.com) is deliberate: it defers
// tracking cookies until playback, which keeps the site's cookieless promise on
// /privacy honest for visitors who never press play.
//
// A game with no entry here simply shows no player — the card still reads.

export type SimulationClip = Readonly<{
  /** YouTube video id (the v= value), not a full URL. */
  videoId: string;
  /** What the clip shows, for the caption and the link's accessible name. */
  label: string;
  /**
   * The uploading channel. Optional only because it is filled in as each
   * upload's rights-holder is verified. The embed works either way; this
   * field exists so that review is auditable rather than assumed — an entry
   * with no channel is an entry whose upload has not been checked yet.
   */
  channel?: string;
  /** Optional start offset in seconds, when the moment is deep in the video. */
  start?: number;
}>;

/**
 * Keyed by simulation id (the `id` on each film record's `simulations` entry).
 * Fill these in as verified rights-holder uploads are confirmed; unfilled games
 * degrade to a card with no player rather than a broken frame.
 */
export const simulationClips: Readonly<Record<string, SimulationClip>> = {
  // ── Casablanca ────────────────────────────────────────────────────────────
  "casablanca-letters": { videoId: "y6ysJI8rmLE", label: "Round up the usual suspects" },
  "casablanca-roulette": { videoId: "vxnpY0owPkA", label: "The wheel comes up twenty-two" },
  "casablanca-runway": { videoId: "rEWaqUVac3M", label: "The airfield farewell" },
  "casablanca-piano": { videoId: "Do2olZ49M54", label: "Ilsa asks Sam for the song" },

  // ── The Matrix ────────────────────────────────────────────────────────────
  "matrix-decode": { videoId: "sjoad6gcRzs", label: "The green code and the wake-up call" },
  "matrix-bullet-time": { videoId: "ODmhPsgqGgQ", label: "The rooftop dodge", start: 20 },
  "matrix-red-or-blue": { videoId: "ky7ksownEEE", label: "The choice of two pills" },

  // ── Blade Runner ──────────────────────────────────────────────────────────
  "blade-runner-vk": { videoId: "OWK6oSbSKKc", label: "The empathy interrogation", start: 2 },
  "blade-runner-enhance": { videoId: "qHepKd38pr0", label: "Walking the photograph" },
  "blade-runner-origami": { videoId: "OyJR7d3Uygw", label: "The folded unicorn", start: 175 },

  // ── 2001: A Space Odyssey ─────────────────────────────────────────────────
  "space-odyssey-podbay": { videoId: "NqCCubrky00", label: "The doors stay shut" },
  "space-odyssey-bone": { videoId: "avjdKTqiVvQ", label: "Bone to satellite", start: 50 },
  "space-odyssey-disconnect": { videoId: "UwCFY6pmaYY", label: "The memory core wind-down", start: 90 },
  "space-odyssey-docking": { videoId: "SpvOUnz4T7Q", label: "The docking waltz" },

  // ── Dune ──────────────────────────────────────────────────────────────────
  "dune-sandwalk": { videoId: "1YFrFSX4cNw", label: "Crossing the sand without rhythm" },
  "dune-gom-jabbar": { videoId: "7SCWy9gsw3E", label: "The hand in the box" },
  "dune-slow-blade": { videoId: "kb4Uy8sU5eI", label: "The shield spar" },

  // ── The Batman ────────────────────────────────────────────────────────────
  "the-batman-riddle": { videoId: "sg1PVVVdvnE", label: "A card from a secret friend" },
  "the-batman-flashlight": { videoId: "pjNE2ck0nDU", label: "The crime scene by torchlight" },
  "the-batman-vengeance": { videoId: "7V36taT2UVs", label: "Out of the shadow" },
  "the-batman-evidence": { videoId: "xT3FXdytoxE", label: "Stringing the board" },

  // ── Parasite ──────────────────────────────────────────────────────────────
  "parasite-con": { videoId: "vA7tRLZu_WI", label: "Rehearsing the cover story" },
  "parasite-stairs": { videoId: "A1Fuae_OS1A", label: "The long descent" },
  "parasite-wifi": { videoId: "81APlCwFdl8", label: "Hunting a signal" },
  "parasite-morse": { videoId: "MhA1u05p-rM", label: "The stair light flickers" },

  // ── Arrival ───────────────────────────────────────────────────────────────
  "arrival-logogram": { videoId: "KxOTbnHzGrI", label: "The first written word" },
  "arrival-translate": { videoId: "m8-H5j538oM", label: "Asking the one question" },

  // ── Mad Max: Fury Road ────────────────────────────────────────────────────
  "fury-road-rig": { videoId: "UtjGTrVwRr4", label: "The rig on the road" },
  "fury-road-witness": { videoId: "RTeY_Rlyn2U", label: "The leap between vehicles" },
  "fury-road-polecat": { videoId: "vlIZc1KjZZo", label: "The pole-cat raid" },
  "fury-road-storm": { videoId: "iTNchgZjufE", label: "Into the dust storm" },

  // ── Her ───────────────────────────────────────────────────────────────────
  "her-letter": { videoId: "j9qrKCbB1KY", label: "Dictating someone else's letter" },
  "her-boot": { videoId: "f9Hg1x-Ctlw", label: "The setup interview" },
  "her-waveform": { videoId: "JdROh4NhwZo", label: "A voice says hello" },

  // ── WALL·E ────────────────────────────────────────────────────────────────
  "wall-e-spork": { videoId: "ruJ76-o5lxU", label: "Fork, spoon… spork" },
  "wall-e-dance": { videoId: "Uj20iZ3bjLo", label: "The extinguisher dance", start: 56 },
  "wall-e-sprout": { videoId: "MGH6Kw4ODGY", label: "The plant in the boot" },

  // ── The Royal Tenenbaums ──────────────────────────────────────────────────
  "royal-tenenbaums-mordecai": { videoId: "GmVCjkcwWCI", label: "The hawk on the roof" },

  // ── Fight Club ────────────────────────────────────────────────────────────
  "fight-club-tourist": { videoId: "7ooDX1NOzEM", label: "The support-group circuit" },

  // ── Goodfellas ────────────────────────────────────────────────────────────
  "goodfellas-helicopter": { videoId: "qo86tUH22dg", label: "Sunday, May 11th" },

  // ── Amadeus ───────────────────────────────────────────────────────────────
  "amadeus-manuscript": { videoId: "th_ro9CiASc", label: "Reading the originals", start: 107 },
  "amadeus-conduct": { videoId: "uP0j7F95XJU", label: "At the podium" },
  "amadeus-notes": { videoId: "H6_eqxh-Qok", label: "Too many notes" },

  // ── WarGames ──────────────────────────────────────────────────────────────
  "wargames-tic-tac-toe": { videoId: "F7qOV8xonfY", label: "The only winning move" },
  "wargames-thermonuclear": { videoId: "YIh41wZEd5c", label: "Shall we play a game" },
};

/**
 * Fired on `window` when an embedded clip starts or stops playing, so the film
 * mode can get out of its way: `detail.playing` true ducks the site's score,
 * false gives it back. The clip player is the only producer.
 */
export const CLIP_PLAYBACK_EVENT = "simulationclipplayback";

/** The origin the player frame posts from — messages from anywhere else are
 * ignored, so a stray postMessage can never mute the site. */
export const CLIP_FRAME_ORIGIN = "https://www.youtube-nocookie.com";

/** The privacy-enhanced player URL for a clip, or null when none is recorded. */
export function clipEmbedSrc(clip: SimulationClip | undefined): string | null {
  if (!clip?.videoId) return null;
  const params = new URLSearchParams({
    // Never autoplay: the player waits for a deliberate press.
    autoplay: "0",
    // Keep related videos within the same channel where YouTube allows it.
    rel: "0",
    playsinline: "1",
    // Lets the frame report play/pause back to the page over postMessage, which
    // is how the film score knows to duck. No YouTube script is loaded for it —
    // the handshake is plain postMessage, so the site's CSP stays closed.
    enablejsapi: "1",
  });
  if (clip.start) params.set("start", String(Math.max(0, Math.floor(clip.start))));
  // The API only posts back to a declared origin, and it is only knowable at
  // runtime; omitted during SSR, where the frame never renders anyway.
  if (typeof window !== "undefined") params.set("origin", window.location.origin);
  return `${CLIP_FRAME_ORIGIN}/embed/${encodeURIComponent(clip.videoId)}?${params}`;
}

/** The public watch URL, used for the "open on YouTube" fallback link. */
export function clipWatchUrl(clip: SimulationClip): string {
  const base = `https://www.youtube.com/watch?v=${encodeURIComponent(clip.videoId)}`;
  return clip.start ? `${base}&t=${Math.floor(clip.start)}` : base;
}
