// Pure logic for the feature-presentation leader (the component lives in
// components/layout/FeaturePresentation.tsx). Kept DOM-free so tests can
// compute tonight's pick without dragging in browser-only modules.

import { FILM_IDS, type FilmId } from "./films/ids";

/** Once the leader has played (or been skipped), it never shows again. */
export const LEADER_SEEN_KEY = "feature-leader-seen";
/** sessionStorage flag + event: the leader committed a film with sound off,
 * so the film controls should pulse their sound toggle until it's used. */
export const SOUND_NUDGE_KEY = "sound-nudge";
export const SOUND_NUDGE_EVENT = "soundnudge";
/** Test hook: presence forces the leader even under automation. */
export const LEADER_FORCE_KEY = "feature-leader-force";

/** Deterministic date-hashed pick: the same film for everyone on a given day. */
export function tonightsFeatureId(date = new Date()): FilmId {
  const key = date.toISOString().slice(0, 10);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FILM_IDS[h % FILM_IDS.length];
}
