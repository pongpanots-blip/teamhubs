import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMembership, requireProjectBySlug } from "@/lib/auth-session";
import { assertAssignable } from "@/lib/tasks/access";
import { allocateTaskNumber } from "@/lib/tasks/next-task-number";
import { errorResponse } from "@/lib/api-error";
import { BusinessRuleSchema, rulesPresent } from "@/lib/business-rules";
import { TASK_COMPONENTS, TASK_COMPONENT_LABEL } from "@/lib/task-constants";
import { buildGrillHandoffDoc } from "@/lib/ai/grill-handoff";
import { notifyTaskEvent } from "@/lib/notify/task-events";
import { projectTask } from "@/lib/routes";

const schema = z.object({
  titleHint: z.string().min(1),
  requirement: z.string().min(1),
  acceptanceCriteria: z.string().default(""),
  businessRules: z.array(BusinessRuleSchema).default([]),
  priority: z.enum(["p0", "p1", "p2", "p3"]).default("p2"),
  /** ISO date the PM committed to during grilling; null when open-ended. */
  deadline: z.string().date().nullable().default(null),
  /** Sub-tasks the PM confirmed after reviewing the AI's proposed breakdown. */
  components: z
    .array(
      z.object({
        component: z.enum(TASK_COMPONENTS),
        title: z.string().min(1),
        description: z.string().default(""),
        assigneeId: z.string().optional().nullable(),
      }),
    )
    .default([]),
  /** Full grilling Q&A, stored as one DecisionLog entry for later review. */
  transcript: z.string().default(""),
  /** Project the finished draft is created under. */
  projectSlug: z.string().min(1),
});

/**
 * Creates the parent task from a completed grilling session, plus one
 * sub-task per confirmed component, wired up so the parent is blocked until
 * every component sub-task is done (reuses the existing dependency + status
 * engine — no new blocking logic needed).
 */
export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const { user, membership } = cx;
    const body = schema.parse(await req.json());
    const { project } = await requireProjectBySlug(cx, body.projectSlug);
    for (const c of body.components) {
      await assertAssignable(project.id, c.assigneeId);
    }

    const [projectRepos, projectFigmaFiles] = await Promise.all([
      prisma.projectRepository.findMany({
        where: { projectId: project.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
      prisma.projectFigmaFile.findMany({
        where: { projectId: project.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
    ]);

    const result = await prisma.$transaction(async (tx) => {
      const { taskNumber: parentTaskNumber } = await allocateTaskNumber(tx, project.id);
      const parent = await tx.task.create({
        data: {
          teamId: membership.teamId,
          projectId: project.id,
          taskNumber: parentTaskNumber,
          title: body.titleHint,
          requirement: body.requirement,
          businessRules: body.businessRules as Prisma.InputJsonValue,
          acceptanceCriteria: body.acceptanceCriteria,
          priority: body.priority,
          deadline: body.deadline ? new Date(body.deadline) : null,
          requirementPresent: true,
          rulesPresent: rulesPresent(body.businessRules),
          acPresent: Boolean(body.acceptanceCriteria.trim()),
          status: "not_ready",
          createdById: user.id,
        },
      });

      const subTasks = [];
      for (const c of body.components) {
        const { taskNumber: subTaskNumber } = await allocateTaskNumber(tx, project.id);
        const sub = await tx.task.create({
          data: {
            teamId: membership.teamId,
            projectId: project.id,
            taskNumber: subTaskNumber,
            title: c.title,
            requirement: c.description,
            component: c.component,
            parentId: parent.id,
            priority: body.priority,
            deadline: body.deadline ? new Date(body.deadline) : null,
            requirementPresent: Boolean(c.description.trim()),
            assigneeId: c.assigneeId ?? null,
            status: c.assigneeId ? "assigned" : "not_ready",
            createdById: user.id,
          },
          include: { assignee: { select: { name: true } } },
        });
        subTasks.push(sub);

        if (sub.assigneeId) {
          await tx.notification.create({
            data: {
              teamId: membership.teamId,
              projectId: project.id,
              userId: sub.assigneeId,
              taskId: sub.id,
              type: "task_assigned",
              title: `📌 Assigned: ${sub.title}`,
              body: `${TASK_COMPONENT_LABEL[c.component]} sub-task for "${parent.title}"`,
            },
          });
        }
      }

      if (subTasks.length) {
        const componentSummaries = subTasks.map((s) => ({
          id: s.id,
          component: s.component! as (typeof TASK_COMPONENTS)[number],
          title: s.title,
          description: s.requirement,
          assigneeName: s.assignee?.name ?? null,
        }));
        await tx.taskHandoff.createMany({
          data: subTasks.map((s, i) => {
            const own = componentSummaries[i];
            const doc = buildGrillHandoffDoc({
              parentTitle: parent.title,
              requirement: body.requirement,
              businessRules: body.businessRules,
              acceptanceCriteria: body.acceptanceCriteria,
              own,
              siblings: componentSummaries.filter((_, j) => j !== i),
              projectRepos: projectRepos.map((r) => ({
                owner: r.owner,
                name: r.name,
                defaultBranch: r.defaultBranch,
                pathPrefix: r.pathPrefix,
                isPrimary: r.isPrimary,
              })),
              projectFigmaFiles: projectFigmaFiles.map((f) => ({
                name: f.name,
                isPrimary: f.isPrimary,
              })),
            });
            return { taskId: s.id, role: "dev", title: doc.title, content: doc.content };
          }),
        });

        await tx.taskDependency.createMany({
          data: subTasks.map((s) => ({
            dependentId: parent.id,
            dependencyId: s.id,
            source: "manual",
          })),
        });
      }

      if (body.transcript.trim()) {
        await tx.decisionLog.create({
          data: {
            taskId: parent.id,
            authorId: user.id,
            decision: "Grilling session completed",
            rationale: body.transcript,
          },
        });
      }

      return { parent, subTasks };
    });

    // Announced after the transaction commits — chat should never see a task
    // that a rolled-back write means does not exist.
    await notifyTaskEvent(
      {
        kind: "created",
        title: result.parent.title,
        subTaskCount: result.subTasks.length,
        priority: result.parent.priority,
        deadline: result.parent.deadline,
      },
      {
        projectName: project.name,
        actorName: user.name,
        url: new URL(
          projectTask(project.slug, result.parent.id),
          new URL(req.url).origin,
        ).toString(),
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
