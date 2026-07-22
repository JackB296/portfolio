/**
 * Shared rank ladder for the Blade Runner sims. Both the Esper enhance and the
 * Voight-Kampff sessions grade a running score into the same three titles, only
 * with different thresholds — so the ladder lives here and the cutoffs stay at
 * each call site.
 */
export function rankFor(score: number, high: number, mid: number): string {
  return score >= high ? "Blade runner" : score >= mid ? "Field examiner" : "Desk analyst";
}
