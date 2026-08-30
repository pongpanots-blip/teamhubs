import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireMembership, requireProjectMembership } from "@/lib/auth-session";
import { BusinessRuleSchema, rulesPresent } from "@/lib/business-rules";
import { TASK_COMPONENTS, TASK_COMPONENT_LABEL } from "@/lib/task-constants";
import { buildGrillHandoffDoc } from "@/lib/ai/grill-handoff";

const schema = z.object({
  titleHint: z.string().min(1),
  requirement: z.string().min(1),
  acceptanceCriteria: z.string().default(""),
  businessRules: z.array(BusinessRuleSchema).default([]),
  priority: z.enum(["p0", "p1", "p2", "p3"]).default("p2"),
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
    const { project } = await requireProjectMembership(cx);
    const body = schema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const parent = await tx.task.create({
        data: {
          teamId: membership.teamId,
          projectId: project.id,
          title: body.titleHint,
          requirement: body.requirement,
          businessRules: body.businessRules as Prisma.InputJsonValue,
          acceptanceCriteria: body.acceptanceCriteria,
          priority: body.priority,
          requirementPresent: true,
          rulesPresent: rulesPresent(body.businessRules),
          acPresent: Boolean(body.acceptanceCriteria.trim()),
          status: "not_ready",
          createdById: user.id,
        },
      });

      const subTasks = [];
      for (const c of body.components) {
        const sub = await tx.task.create({
          data: {
            teamId: membership.teamId,
            projectId: project.id,
            title: c.title,
            requirement: c.description,
            component: c.component,
            priority: body.priority,
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

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
