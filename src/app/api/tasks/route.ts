import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMembership, requireProjectMembership } from "@/lib/auth-session";
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
  status: z.enum(TASK_STATUSES).optional(),
});

export async function GET() {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectMembership(cx);
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
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}

export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const { user, membership } = cx;
    const { project } = await requireProjectMembership(cx);
    const body = createSchema.parse(await req.json());

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

    const task = await prisma.task.create({
      data: {
        teamId: membership.teamId,
        projectId: project.id,
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
        createdById: user.id,
      },
    });

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
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
