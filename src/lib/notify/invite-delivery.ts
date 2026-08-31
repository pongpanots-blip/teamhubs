import { postToChat, type ChatDelivery } from "@/lib/notify/chat";

/** Delivery outcome for a new invite — shown to the PM who created it. */
export type InviteDelivery = ChatDelivery;

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
  return postToChat(formatInviteMessage(m));
}
