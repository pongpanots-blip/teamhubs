import type { InviteDelivery } from "@/lib/notify/invite-delivery";

/**
 * What the PM sees after creating an invite. The link is always shown: when
 * delivery is off or failed it is the only way to hand the invite over, and
 * even on success the PM may want to send it themselves as well.
 */
export function inviteResultMessage(
  acceptUrl: string,
  delivery?: InviteDelivery | null,
): string {
  if (delivery?.ok) return `ส่งคำเชิญเข้าแชทแล้ว · ลิงก์: ${acceptUrl}`;
  if (delivery?.attempted) {
    return `สร้างคำเชิญแล้ว แต่ส่งเข้าแชทไม่สำเร็จ (${delivery.error ?? "unknown error"}) — ส่งลิงก์นี้ให้เขาเอง: ${acceptUrl}`;
  }
  return `สร้างคำเชิญแล้ว — ส่งลิงก์นี้ให้เขา: ${acceptUrl}`;
}
