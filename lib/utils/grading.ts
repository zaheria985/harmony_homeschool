/**
 * Get letter grade from a numeric score using provided thresholds.
 * Thresholds should be sorted by min_score descending.
 */
export function getLetterGrade(
  numericGrade: number,
  thresholds: { letter: string; min_score: number; color?: string | null }[]
): { letter: string; color: string | null } | null {
  if (!thresholds || thresholds.length === 0) return null;

  // Sort descending by min_score to find the first threshold the grade meets
  const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);
  for (const t of sorted) {
    if (numericGrade >= t.min_score) {
      return { letter: t.letter, color: t.color || null };
    }
  }
  // If below all thresholds, return the lowest one
  const lowest = sorted[sorted.length - 1];
  return { letter: lowest.letter, color: lowest.color || null };
}
