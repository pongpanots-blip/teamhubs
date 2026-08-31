/**
 * Decides how a grill turn's `recommendation` should render: badge an exact
 * matching choice, or fall back to a free-text hint line when it doesn't
 * match any choice (including when there are no choices at all).
 */
export function resolveRecommendation(
  choices: string[] | null,
  recommendation: string | null,
): { matchedChoice: string | null; hintText: string | null } {
  if (!recommendation) return { matchedChoice: null, hintText: null };
  if (choices?.includes(recommendation)) {
    return { matchedChoice: recommendation, hintText: null };
  }
  return { matchedChoice: null, hintText: recommendation };
}
