"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAssessmentByToken, isExpired } from "@/lib/attempt-access";
import { computeAttempt } from "@/lib/attempt";
import { SUPPORTED_TYPES } from "@/lib/labels";

export async function startAttempt(token: string, form: FormData) {
  const a = await getAssessmentByToken(token);
  if (!a || isExpired(a)) redirect(`/t/${token}`);
  if (form.get("consent") !== "on") redirect(`/t/${token}?consent=required`);
  if (a.status === "SUBMITTED") redirect(`/t/${token}/done`);

  const current = a.attempts[0];
  if (!current || current.finishedAt) {
    const questions = await db.question.findMany({
      where: {
        status: "ACTIVE",
        type: { in: [...SUPPORTED_TYPES] },
        competency: { positionId: a.positionId },
      },
      include: { competency: { select: { sortOrder: true } } },
    });
    questions.sort((x, y) => x.competency.sortOrder - y.competency.sortOrder || x.level - y.level);
    await db.attempt.create({
      data: { assessmentId: a.id, consentAt: new Date(), questionIds: questions.map((q) => q.id) },
    });
    await db.assessment.update({ where: { id: a.id }, data: { status: "STARTED" } });
  }
  redirect(`/t/${token}/test`);
}

const answerSchema = z.object({
  questionId: z.string().min(1),
  selected: z.union([z.number().int().min(0).max(20), z.array(z.number().int().min(0).max(20)).max(20), z.null()]).optional(),
  text: z.string().max(5000).optional(),
  timeMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
});

async function activeAttempt(token: string) {
  const a = await getAssessmentByToken(token);
  const attempt = a?.attempts[0];
  if (!a || !attempt || attempt.finishedAt || a.status === "SUBMITTED") return null;
  return { assessment: a, attempt };
}

export async function saveResponse(token: string, input: unknown) {
  const ctx = await activeAttempt(token);
  if (!ctx) return { ok: false as const };
  const data = answerSchema.parse(input);
  if (!(ctx.attempt.questionIds as string[]).includes(data.questionId)) return { ok: false as const };

  const payload = { selected: data.selected ?? null, text: data.text ?? "" };
  await db.response.upsert({
    where: { attemptId_questionId: { attemptId: ctx.attempt.id, questionId: data.questionId } },
    create: { attemptId: ctx.attempt.id, questionId: data.questionId, payload, timeMs: data.timeMs ?? 0 },
    update: { payload, timeMs: data.timeMs ?? 0, score: null, scoreSource: null, reviewed: false },
  });
  return { ok: true as const };
}

export async function logSignal(token: string, type: "focus_lost" | "paste") {
  const ctx = await activeAttempt(token);
  if (!ctx || (type !== "focus_lost" && type !== "paste")) return;
  await db.integritySignal.create({ data: { attemptId: ctx.attempt.id, type } });
}

export async function finishAttempt(token: string) {
  const ctx = await activeAttempt(token);
  if (!ctx) redirect(`/t/${token}/done`);
  await db.attempt.update({ where: { id: ctx.attempt.id }, data: { finishedAt: new Date() } });
  await db.assessment.update({ where: { id: ctx.assessment.id }, data: { status: "SUBMITTED" } });
  try {
    await computeAttempt(ctx.attempt.id);
  } catch (err) {
    // Javoblar saqlangan; natija HR sahifasi ochilganda qayta hisoblanadi.
    console.error("computeAttempt failed", err);
  }
  redirect(`/t/${token}/done`);
}
