import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/auth-session";
import { requireSprintAccess } from "@/lib/sprint/access";
import { sprintBurndown } from "@/lib/sprint/service";
import { errorResponse } from "@/lib/api-error";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireSprintAccess(cx, id);
    return NextResponse.json(await sprintBurndown(id));
  } catch (e) {
    return errorResponse(e);
  }
}
