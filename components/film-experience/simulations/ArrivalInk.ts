// Stroke geometry for "Draw the logogram". Kept apart from the component so
// the scoring is pure, readable, and testable on its own terms: a heptapod
// logogram is judged on whether the ink comes back to itself (closure), holds
// a constant radius (roundness), moves without hesitation (smoothness), and
// travels exactly once around (wholeness).

/** A sampled ink point in normalized 0–1 canvas space, with its timestamp. */
export type InkPoint = Readonly<{ x: number; y: number; t: number }>;

export type StrokeGrade = Readonly<{
  closure: number;
  roundness: number;
  smoothness: number;
  wholeness: number;
  /** 0–100. */
  score: number;
  centroid: Readonly<{ x: number; y: number }>;
  radius: number;
  length: number;
}>;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

const dist = (a: InkPoint, b: InkPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Wrap an angle into (-π, π]. */
function wrap(angle: number) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

const EMPTY_GRADE: StrokeGrade = {
  closure: 0,
  roundness: 0,
  smoothness: 0,
  wholeness: 0,
  score: 0,
  centroid: { x: 0.5, y: 0.5 },
  radius: 0,
  length: 0,
};

/** How far the ink travelled, in normalized units. */
export function pathLength(points: readonly InkPoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += dist(points[i], points[i - 1]);
  return total;
}

/**
 * Grade a stroke as a ring. Every axis is normalized to 0–1 and weighted; the
 * weights favour closure because that is the thing the film is about — a
 * sentence that ends where it began.
 */
export function gradeRing(points: readonly InkPoint[]): StrokeGrade {
  if (points.length < 8) return EMPTY_GRADE;

  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const radius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const length = pathLength(points);
  if (radius < 0.02 || length < 0.25) return { ...EMPTY_GRADE, centroid: { x: cx, y: cy }, radius, length };

  // Closure: the gap between the first and last point, read against the ring's
  // own scale so a small ring is not held to a large ring's tolerance.
  const gap = dist(points[0], points[points.length - 1]);
  const closure = clamp01(1 - gap / (radius * 1.5));

  // Roundness: spread of the radius around its mean.
  const variance =
    radii.reduce((sum, r) => sum + (r - radius) ** 2, 0) / radii.length;
  const roundness = clamp01(1 - Math.sqrt(variance) / (radius * 0.5));

  // Smoothness and wholeness both come out of the turn-by-turn heading.
  const deltas: number[] = [];
  let previous: number | null = null;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.hypot(dx, dy) < 1e-5) continue;
    const heading = Math.atan2(dy, dx);
    if (previous !== null) deltas.push(wrap(heading - previous));
    previous = heading;
  }
  if (deltas.length < 4) {
    return { ...EMPTY_GRADE, centroid: { x: cx, y: cy }, radius, length };
  }
  const sum = deltas.reduce((total, d) => total + d, 0);
  const absSum = deltas.reduce((total, d) => total + Math.abs(d), 0);
  // A perfect circle turns steadily in one direction: |Σθ| == Σ|θ|. Wobble and
  // backtracking inflate Σ|θ| without moving Σθ.
  const smoothness = clamp01(1 - (absSum - Math.abs(sum)) / 2.2);
  const turns = Math.abs(sum) / (Math.PI * 2);
  const wholeness = clamp01(1 - Math.abs(turns - 1) / 0.6);

  const score = Math.round(
    100 * (closure * 0.34 + roundness * 0.24 + smoothness * 0.22 + wholeness * 0.2)
  );

  return {
    closure,
    roundness,
    smoothness,
    wholeness,
    score,
    centroid: { x: cx, y: cy },
    radius,
    length,
  };
}

/**
 * Grade a stem: the short tail that hangs off a logogram. Judged on how
 * straight it runs and whether it actually touches the ring it belongs to,
 * reusing the ring grade's centroid and radius as the attachment target.
 */
export function gradeStem(points: readonly InkPoint[], ring: StrokeGrade): StrokeGrade {
  if (points.length < 4) return EMPTY_GRADE;
  const first = points[0];
  const last = points[points.length - 1];
  const span = dist(first, last);
  const length = pathLength(points);
  if (span < 0.05) return { ...EMPTY_GRADE, length };

  // Straightness: a straight stem's travelled path equals its span.
  const straightness = clamp01(1 - (length - span) / (span * 0.8));

  // Attachment: one end should sit on the ring's edge.
  const ringGap = Math.min(
    Math.abs(Math.hypot(first.x - ring.centroid.x, first.y - ring.centroid.y) - ring.radius),
    Math.abs(Math.hypot(last.x - ring.centroid.x, last.y - ring.centroid.y) - ring.radius)
  );
  const attachment = clamp01(1 - ringGap / Math.max(0.08, ring.radius * 0.7));

  // Reach: a stem has to actually leave the ring, not be a stray dot.
  const reach = clamp01(span / Math.max(0.12, ring.radius * 0.9));

  const score = Math.round(100 * (straightness * 0.34 + attachment * 0.4 + reach * 0.26));
  return {
    closure: attachment,
    roundness: straightness,
    smoothness: straightness,
    wholeness: reach,
    score,
    centroid: { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
    radius: span / 2,
    length,
  };
}

/**
 * How well two rings sit inside one another: shared centre, distinct radii.
 * Returns a 0–1 factor applied as a bonus to the double-ring utterance.
 */
export function concentricity(a: StrokeGrade, b: StrokeGrade) {
  if (a.radius <= 0 || b.radius <= 0) return 0;
  const offset = Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y);
  const shared = clamp01(1 - offset / (Math.max(a.radius, b.radius) * 0.8));
  const separation = clamp01(
    Math.abs(a.radius - b.radius) / (Math.max(a.radius, b.radius) * 0.45)
  );
  return shared * 0.6 + separation * 0.4;
}

/**
 * A machine-drawn stroke, used by the keyboard path so the game never demands
 * a pointer. `wobble` keeps the traced ink from being suspiciously perfect
 * while staying comfortably above every threshold.
 */
export function traceRing(
  cx: number,
  cy: number,
  radius: number,
  steps = 56,
  wobble = 0.004
): InkPoint[] {
  const points: InkPoint[] = [];
  const now = typeof performance === "undefined" ? Date.now() : performance.now();
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const r = radius + Math.sin(angle * 3) * wobble;
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      t: now + step * 12,
    });
  }
  return points;
}

/** A machine-drawn stem running outward from a ring's edge. */
export function traceStem(cx: number, cy: number, radius: number): InkPoint[] {
  const points: InkPoint[] = [];
  const now = typeof performance === "undefined" ? Date.now() : performance.now();
  const steps = 16;
  const angle = Math.PI / 4;
  for (let step = 0; step <= steps; step += 1) {
    const r = radius + (step / steps) * radius * 0.75;
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      t: now + step * 12,
    });
  }
  return points;
}

/**
 * Ink width for a segment: slow, deliberate ink pools wide; a fast flick runs
 * thin. Speed is normalized units per millisecond.
 */
export function inkWidth(a: InkPoint, b: InkPoint, base: number) {
  const elapsed = Math.max(1, b.t - a.t);
  const speed = dist(a, b) / elapsed;
  const weight = clamp01(1 - speed / 0.004);
  return base * (0.45 + weight * 0.95);
}
