/**
 * One outgoing chat webhook for the whole system — invites and task activity
 * both land in the same room.
 *
 * Configured with CHAT_WEBHOOK_URL: an incoming webhook from either Discord or
 * Google Chat. The two differ only in the JSON key they accept, and the host
 * tells them apart, so there is no provider setting to keep in sync with the URL.
 */

export type ChatDelivery = {
  /** False when no webhook is configured — nothing was sent and nothing failed. */
  attempted: boolean;
  ok: boolean;
  /** Set only when a configured webhook was tried and failed. */
  error?: string;
};

const NOT_CONFIGURED: ChatDelivery = { attempted: false, ok: false };

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

/** Never throws: every caller treats chat as best-effort next to its real work. */
export async function postToChat(text: string): Promise<ChatDelivery> {
  const raw = process.env.CHAT_WEBHOOK_URL?.trim();
  if (!raw) return NOT_CONFIGURED;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { attempted: true, ok: false, error: "CHAT_WEBHOOK_URL is not a valid URL" };
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
      body: JSON.stringify(payload(kind, text)),
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
