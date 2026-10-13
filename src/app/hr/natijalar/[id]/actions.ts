"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireWriter } from "@/lib/auth";
import { computeAttempt } from "@/lib/attempt";

export async function setDecision(attemptId: string, decision: "ADVANCE" | "REJECT" | null) {
  const user = await requireWriter();
  await db.attemptResult.update({ where: { attemptId }, data: { decision } });
  await db.auditLog.create({
    data: { actorId: user.id, action: "result.decision", entity: "Attempt", entityId: attemptId, meta: { decision } },
  });
  revalidatePath(`/hr/natijalar/${attemptId}`);
  revalidatePath("/hr/natijalar");
  revalidatePath("/hr");
}

const REASONS = ["Rubrika bo'yicha", "Avto-baho xato", "Qo'shimcha kontekst", "Boshqa"] as const;
const overrideSchema = z.object({
  responseId: z.string().min(1),
  score: z.coerce.number().min(0).max(1),
  reason: z.enum(REASONS),
});

/** Javob ballini qo'lda o'zgartirish: sabab majburiy, tarixda qayd etiladi. */
export async function overrideResponse(form: FormData) {
  const user = await requireWriter();
  const parsed = overrideSchema.safeParse({
    responseId: form.get("responseId"),
    score: form.get("score"),
    reason: form.get("reason"),
  });
  if (!parsed.success) throw new Error("Ball va sabab majburiy");
  const { responseId, score, reason } = parsed.data;
  const before = await db.response.findUniqueOrThrow({ where: { id: responseId }, select: { score: true, attemptId: true } });
  await db.response.update({
    where: { id: responseId },
    data: { score, scoreSource: "human", reviewed: true, overrideReason: reason },
  });
  await computeAttempt(before.attemptId);
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "response.review",
      entity: "Response",
      entityId: responseId,
      meta: { before: before.score, after: score, reason },
    },
  });
  revalidatePath(`/hr/natijalar/${before.attemptId}`);
  revalidatePath("/hr/natijalar");
  revalidatePath("/hr");
}

const commentSchema = z.object({ attemptId: z.string().min(1), text: z.string().trim().min(1).max(1000) });

export async function addComment(form: FormData) {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({ attemptId: form.get("attemptId"), text: form.get("text") });
  if (!parsed.success) return;
  await db.comment.create({ data: { ...parsed.data, authorId: user.id } });
  revalidatePath(`/hr/natijalar/${parsed.data.attemptId}`);
}
