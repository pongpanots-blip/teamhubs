import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordStatusChange } from "@/lib/tasks/status-history";
import { requireMembership } from "@/lib/auth-session";
import { requireProjectFromQuery } from "@/lib/project-scope";
import { assertAssignable } from "@/lib/tasks/access";
import { allocateTaskNumber } from "@/lib/tasks/next-task-number";
import { errorResponse } from "@/lib/api-error";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/task-constants";
import { BusinessRuleSchema, rulesPresent } from "@/lib/business-rules";
import { extractDynamicRequirement } from "@/lib/ai/extract-rules";
import { httpUrlSchema } from "@/lib/url-schema";

const createSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  /** Free-form PM intent — extracted into BusinessRules[] when provided */
  intent: z.string().optional(),
  requirement: z.string().optional(),
  businessRules: z.array(BusinessRuleSchema).optional(),
  acceptanceCriteria: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  deadline: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  figmaUrl: httpUrlSchema.optional().nullable(),
  figmaReady: z.boolean().optional(),
  githubIssueUrl: httpUrlSchema.optional().nullable(),
  apiReady: z.boolean().optional(),
  internalDocPaths: z.array(z.string()).optional(),
  dependencyIds: z.array(z.string()).optional(),
  /** Set to make the new task a sub-task of an existing task in the same project. */
  parentId: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
});

export async function GET(req: Request) {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectFromQuery(cx, req);
    const tasks = await prisma.task.findMany({
      where: { projectId: project.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        dependsOn: {
          include: { dependency: { select: { id: true, title: true, status: true } } },
        },
        _count: { select: { decisions: true } },
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const { user, membership } = cx;
    const { project } = await requireProjectFromQuery(cx, req);
    const body = createSchema.parse(await req.json());
    await assertAssignable(project.id, body.assigneeId);

    // A parent from another project would give the sub-task two owners; reject
    // rather than silently dropping the link.
    if (body.parentId) {
      const parent = await prisma.task.findFirst({
        where: { id: body.parentId, projectId: project.id },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ error: "PARENT_NOT_FOUND" }, { status: 404 });
    }

    let requirement = body.requirement ?? "";
    let businessRules = body.businessRules ?? [];
    let title = body.title ?? "";

    if (body.intent?.trim()) {
      const extracted = await extractDynamicRequirement(body.intent);
      if (!requirement) requirement = extracted.requirement;
      if (!businessRules.length) businessRules = extracted.businessRules;
      if (!title) title = extracted.titleHint || "Untitled requirement";
    }

    if (!title.trim()) {
      return NextResponse.json({ error: "TITLE_OR_INTENT_REQUIRED" }, { status: 400 });
    }

    const acceptanceCriteria = body.acceptanceCriteria ?? "";
    const initialStatus =
      body.status ?? (body.assigneeId ? "assigned" : "not_ready");

    const task = await prisma.$transaction(async (tx) => {
      const { taskNumber } = await allocateTaskNumber(tx, project.id);
      return tx.task.create({
        data: {
          teamId: membership.teamId,
          projectId: project.id,
          taskNumber,
          title,
          description: body.description ?? "",
          requirement,
          businessRules: businessRules as Prisma.InputJsonValue,
          acceptanceCriteria,
          priority: body.priority ?? "p2",
          deadline: body.deadline ? new Date(body.deadline) : null,
          requirementPresent: Boolean(requirement.trim() || acceptanceCriteria.trim()),
          rulesPresent: rulesPresent(businessRules),
          acPresent: Boolean(acceptanceCriteria.trim()),
          assigneeId: body.assigneeId ?? null,
          figmaUrl: body.figmaUrl ?? null,
          figmaReady: body.figmaReady ?? false,
          githubIssueUrl: body.githubIssueUrl ?? null,
          apiReady: body.apiReady ?? false,
          internalDocPaths: body.internalDocPaths ?? [],
          designLinked: Boolean(body.figmaUrl),
          status: initialStatus === "working" ? "assigned" : initialStatus,
          parentId: body.parentId ?? null,
          createdById: user.id,
        },
      });
    });

    await recordStatusChange({
      taskId: task.id,
      from: null,
      to: task.status,
      changedById: user.id,
    });

    // Same wiring grilling uses: the parent stays blocked until its sub-tasks
    // are done, via the existing dependency + status engine.
    if (body.parentId) {
      await prisma.taskDependency.create({
        data: { dependentId: body.parentId, dependencyId: task.id, source: "manual" },
      });
    }

    if (body.dependencyIds?.length) {
      await prisma.taskDependency.createMany({
        data: body.dependencyIds.map((dependencyId) => ({
          dependentId: task.id,
          dependencyId,
          source: "manual",
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
