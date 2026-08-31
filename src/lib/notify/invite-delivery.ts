/**
 * Delivers a new invite to the team's chat instead of email — the invite link
 * is useless sitting in an API response nobody reads.
 *
 * Configured with a single env var, INVITE_WEBHOOK_URL: an incoming webhook
 * from either Discord or Google Chat. The two differ only in the JSON key they
 * accept, and the host tells them apart, so there is no provider setting to
 * keep in sync with the URL.
 */

export type InviteDelivery = {
  /** False when no webhook is configured — the PM copies the link by hand. */
  attempted: boolean;
  ok: boolean;
  /** Set only when a configured webhook was tried and failed. */
  error?: string;
};

const NOT_CONFIGURED: InviteDelivery = { attempted: false, ok: false };

type WebhookKind = "discord" | "google_chat";

function webhookKind(url: URL): WebhookKind | null {
  if (url.hostname.endsWith("discord.com") || url.hostname.endsWith("discordapp.com")) {
    return "discord";
  }
  if (url.hostname.endsWith("googleapis.com")) return "google_chat";
  return null;
}

/** Discord reads `content`, Google Chat reads `text`. Both take plain markdown-ish text. */
function payload(kind: WebhookKind, text: string): Record<string, string> {
  return kind === "discord" ? { content: text } : { text };
}

export type InviteMessage = {
  email: string;
  role: string;
  /** Absolute URL — a relative one is unusable once it leaves the app. */
  acceptUrl: string;
  invitedByName: string;
  teamName: string;
  projectName?: string | null;
};

export function formatInviteMessage(m: InviteMessage): string {
  const where = m.projectName ? `${m.teamName} · ${m.projectName}` : m.teamName;
  return [
    `📨 **${m.email}** ถูกเชิญเข้า ${where} เป็น \`${m.role}\` โดย ${m.invitedByName}`,
    `เปิดลิงก์นี้เพื่อรับคำเชิญ (หมดอายุใน 14 วัน): ${m.acceptUrl}`,
  ].join("\n");
}

export async function deliverInvite(m: InviteMessage): Promise<InviteDelivery> {
  const raw = process.env.INVITE_WEBHOOK_URL?.trim();
  if (!raw) return NOT_CONFIGURED;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { attempted: true, ok: false, error: "INVITE_WEBHOOK_URL is not a valid URL" };
  }
  const kind = webhookKind(url);
  if (!kind) {
    return {
      attempted: true,
      ok: false,
      error: `Unsupported webhook host "${url.hostname}" — expected Discord or Google Chat`,
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(kind, formatInviteMessage(m))),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { attempted: true, ok: false, error: `${kind} webhook returned ${res.status}` };
    }
    return { attempted: true, ok: true };
  } catch (e) {
    return { attempted: true, ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
