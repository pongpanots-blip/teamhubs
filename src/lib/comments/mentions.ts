export type Mentionable = { id: string; name: string };

/**
 * Resolves `@Name` (possibly multi-word) tags in a comment body against the
 * project's members. Longest name wins so "@Joe Anderson" doesn't collapse
 * onto a shorter "@Joe" on the same roster. Order is first-appearance;
 * duplicate mentions of the same person collapse to one id.
 */
export function parseMentions(body: string, members: Mentionable[]): string[] {
  const byLongestName = [...members].sort((a, b) => b.name.length - a.name.length);
  const seen = new Set<string>();
  const ids: string[] = [];

  const atPositions = [...body.matchAll(/@/g)].map((m) => m.index!);
  for (const pos of atPositions) {
    const rest = body.slice(pos + 1);
    const match = byLongestName.find((m) => rest.startsWith(m.name));
    if (!match) continue;
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    ids.push(match.id);
  }
  return ids;
}
