import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess, assertAssignable } from "@/lib/tasks/access";
import { errorResponse } from "@/lib/api-error";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskStatusValue } from "@/lib/task-constants";
import {
  BusinessRuleSchema,
  parseBusinessRules,
  rulesPresent,
} from "@/lib/business-rules";
import { extractDynamicRequirement } from "@/lib/ai/extract-rules";
import { notifyTaskEvent } from "@/lib/notify/task-events";
import { projectTask } from "@/lib/routes";
import { cascadeFromTask } from "@/lib/engine/cascade";
import { httpUrlSchema } from "@/lib/url-schema";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  intent: z.string().optional(),
  requirement: z.string().optional(),
  businessRules: z.array(BusinessRuleSchema).optional(),
  acceptanceCriteria: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.string().nullable().optional(),
  figmaUrl: httpUrlSchema.nullable().optional(),
  figmaReady: z.boolean().optional(),
  githubIssueUrl: httpUrlSchema.nullable().optional(),
  githubPrUrl: httpUrlSchema.nullable().optional(),
  apiReady: z.boolean().optional(),
  internalDocPaths: z.array(z.string()).optional(),
  dependencyIds: z.array(z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        dependsOn: { include: { dependency: true } },
        dependedBy: { include: { dependent: true } },
        decisions: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        contextRuns: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({
      task: {
        ...task,
        businessRules: parseBusinessRules(task.businessRules),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    const { project } = await requireTaskAccess(cx, id);
    const existing = await prisma.task.findUniqueOrThrow({ where: { id } });

    const body = updateSchema.parse(await req.json());
    await assertAssignable(project.id, body.assigneeId);

    let requirement = body.requirement;
    let businessRules = body.businessRules;
    let title = body.title;

    if (body.intent?.trim()) {
      const extracted = await extractDynamicRequirement(body.intent);
      if (requirement === undefined) requirement = extracted.requirement;
      if (businessRules === undefined) businessRules = extracted.businessRules;
      if (title === undefined && !existing.title) title = extracted.titleHint;
    }

    let nextStatus = body.status;
    if (
      body.assigneeId !== undefined &&
      body.assigneeId &&
      !body.status &&
      (existing.status === "not_ready" || existing.status === "ready")
    ) {
      nextStatus = "assigned";
    }

    const nextRequirement = requirement ?? existing.requirement;
    const nextAc = body.acceptanceCriteria ?? existing.acceptanceCriteria;
    const nextRules =
      businessRules ?? parseBusinessRules(existing.businessRules);

    const task = await prisma.task.update({
      where: { id },
      data: {
        title,
        description: body.description,
        requirement,
        businessRules:
          businessRules === undefined
            ? undefined
            : (nextRules as Prisma.InputJsonValue),
        acceptanceCriteria: body.acceptanceCriteria,
        requirementPresent:
          requirement !== undefined || body.acceptanceCriteria !== undefined
            ? Boolean(nextRequirement.trim() || nextAc.trim())
            : undefined,
        rulesPresent:
          businessRules !== undefined ? rulesPresent(nextRules) : undefined,
        acPresent:
          body.acceptanceCriteria !== undefined
            ? Boolean(body.acceptanceCriteria.trim())
            : undefined,
        priority: body.priority,
        deadline:
          body.deadline === undefined
            ? undefined
            : body.deadline
              ? new Date(body.deadline)
              : null,
        status: nextStatus,
        assigneeId: body.assigneeId,
        figmaUrl: body.figmaUrl,
        figmaReady: body.figmaReady,
        designLinked: body.figmaUrl !== undefined ? Boolean(body.figmaUrl) : undefined,
        githubIssueUrl: body.githubIssueUrl,
        githubPrUrl: body.githubPrUrl,
        apiReady: body.apiReady,
        internalDocPaths: body.internalDocPaths,
      },
    });

    if (body.dependencyIds) {
      await prisma.taskDependency.deleteMany({ where: { dependentId: id, source: "manual" } });
      if (body.dependencyIds.length) {
        await prisma.taskDependency.createMany({
          data: body.dependencyIds.map((dependencyId) => ({
            dependentId: id,
            dependencyId,
            source: "manual",
          })),
          skipDuplicates: true,
        });
      }
    }

    if (task.status !== existing.status) {
      await notifyTaskEvent(
        {
          kind: "status",
          title: task.title,
          from: existing.status as TaskStatusValue,
          to: task.status as TaskStatusValue,
        },
        {
          projectName: project.name,
          actorName: cx.user.name,
          url: new URL(projectTask(project.slug, task.id), new URL(req.url).origin).toString(),
        },
      );
    }

    // A status change (API done) or a rewired graph can unblock other people's
    // tasks. Re-evaluate them now rather than waiting for someone to open them.
    const cascade =
      task.status !== existing.status || body.dependencyIds
        ? await cascadeFromTask(id)
        : [];

    return NextResponse.json({
      task: { ...task, businessRules: parseBusinessRules(task.businessRules) },
      cascade: cascade
        .filter((c) => c.changed)
        .map((c) => ({
          taskId: c.task.id,
          title: c.task.title,
          from: c.previousStatus,
          to: c.status,
        })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
