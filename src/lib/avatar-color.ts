/** A handful of hues from the app's own status palette, hashed by name so each
 * person reads as one consistent color across cards — not a flat gray blob. */
const AVATAR_PALETTE = [
  "var(--st-assigned)",
  "var(--st-ready)",
  "var(--st-working-strong)",
  "var(--st-done)",
  "var(--st-review)",
  "var(--violet)",
];

export function avatarColor(name: string | null | undefined): string {
  if (!name) return "var(--muted-foreground)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
