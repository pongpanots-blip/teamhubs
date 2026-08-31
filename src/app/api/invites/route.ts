import { NextResponse } from "next/server";
import { z } from "zod";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMembership, requireProjectBySlug, assertRole } from "@/lib/auth-session";
import { errorResponse } from "@/lib/api-error";
import { TEAM_ROLES } from "@/lib/task-constants";
import { deliverInvite } from "@/lib/notify/invite-delivery";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(TEAM_ROLES).default("backend"),
  /** Optional: also make them a member of this project on accept. */
  projectSlug: z.string().min(1).optional(),
  projectRole: z.enum(TEAM_ROLES).optional(),
});

export async function GET() {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm"]);
    const invites = await prisma.invite.findMany({
      where: { teamId: membership.teamId },
      include: { project: { select: { slug: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invites });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const { user, membership } = cx;
    assertRole(membership.role, ["pm"]);
    const body = schema.parse(await req.json());
    const project = body.projectSlug
      ? (await requireProjectBySlug(cx, body.projectSlug)).project
      : null;

    const invite = await prisma.invite.create({
      data: {
        teamId: membership.teamId,
        projectId: project?.id ?? null,
        projectRole: project ? (body.projectRole ?? body.role) : null,
        email: body.email.toLowerCase(),
        role: body.role,
        invitedById: user.id,
        expiresAt: addDays(new Date(), 14),
      },
    });
    const acceptPath = `/invite/${invite.token}`;
    // Delivery is best-effort: the invite row is already committed, and the PM
    // can always hand over the link themselves if the webhook is down.
    const delivery = await deliverInvite({
      email: invite.email,
      role: invite.role,
      acceptUrl: new URL(acceptPath, new URL(req.url).origin).toString(),
      invitedByName: user.name,
      teamName: membership.team.name,
      projectName: project?.name ?? null,
    });

    return NextResponse.json({ invite, acceptUrl: acceptPath, delivery });
  } catch (e) {
    return errorResponse(e);
  }
}
