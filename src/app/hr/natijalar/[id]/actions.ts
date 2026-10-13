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

const contextSchema = z.object({ attemptId: z.string().min(1), text: z.string().trim().max(4000) });

/** Real ish natijalari / rahbar bahosi — AI tahlilga qo'shimcha kontekst sifatida beriladi. */
export async function saveContext(attemptId: string, text: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireWriter();
  const p = contextSchema.safeParse({ attemptId, text });
  if (!p.success) return { ok: false, message: "Matn 4000 belgidan oshmasligi kerak" };
  await db.attemptResult.update({ where: { attemptId }, data: { hrContext: p.data.text || null } });
  await db.auditLog.create({ data: { actorId: user.id, action: "result.context", entity: "Attempt", entityId: attemptId, meta: { chars: p.data.text.length } } });
  revalidatePath(`/hr/natijalar/${attemptId}`);
  return { ok: true, message: "Saqlandi" };
}

// ---------------------------------------------------------------------------------------------
// AI bosqichlari (PROMPT-TEST-TAHLIL.md): 1) ochiq javoblarni baholash, 3) chuqur tahlil.
// Raqamlarni (ball, foiz, xulosa toifasi) formula hisoblaydi, AI faqat matn yozadi.

import { allow } from "@/lib/rate-limit";
import { AiError, aiConfigured } from "@/lib/ai/client";
import { generateAnalysis, gradeOpenAnswers } from "@/lib/ai/review";

export type AiActionResult = { ok: boolean; message: string };

function describe(e: unknown): string {
  if (e instanceof AiError) {
    if (e.code === "not_configured") return "AI sozlanmagan: ANTHROPIC_API_KEY o'rnatilmagan.";
    if (e.code === "refusal") return "Model so'rovni rad etdi. Qo'lda baholashdan foydalaning.";
    return e.message;
  }
  return "Kutilmagan xato. Keyinroq urinib ko'ring.";
}

export async function runGrading(attemptId: string): Promise<AiActionResult> {
  const user = await requireWriter();
  if (!aiConfigured()) return { ok: false, message: describe(new AiError("not_configured", "")) };
  if (!(await allow(`ai:${user.id}`, 40, 3600))) return { ok: false, message: "AI chaqiruvlari limiti oshdi. Bir soatdan keyin urinib ko'ring." };
  try {
    const s = await gradeOpenAnswers(attemptId);
    await db.auditLog.create({
      data: { actorId: user.id, action: "ai.grade", entity: "Attempt", entityId: attemptId, meta: { ...s } },
    });
    revalidatePath(`/hr/natijalar/${attemptId}`);
    revalidatePath("/hr/natijalar");
    const parts = [`${s.graded} ta ochiq javob AI bilan baholandi`];
    if (s.tooShort) parts.push(`${s.tooShort} tasi juda qisqa (0 ball)`);
    if (s.noRubric) parts.push(`${s.noRubric} tasida rubrika yo'q (baholanmadi)`);
    if (s.lowConfidence) parts.push(`${s.lowConfidence} tasida ishonch past — ko'rib chiqing`);
    if (s.injection) parts.push(`${s.injection} tasida baholovchiga ko'rsatma berishga urinish aniqlandi`);
    return { ok: true, message: parts.join(" · ") };
  } catch (e) {
    return { ok: false, message: describe(e) };
  }
}

export async function runAnalysis(attemptId: string): Promise<AiActionResult> {
  const user = await requireWriter();
  if (!aiConfigured()) return { ok: false, message: describe(new AiError("not_configured", "")) };
  if (!(await allow(`ai:${user.id}`, 40, 3600))) return { ok: false, message: "AI chaqiruvlari limiti oshdi. Bir soatdan keyin urinib ko'ring." };
  try {
    const r = await generateAnalysis(attemptId);
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "ai.analysis",
        entity: "Attempt",
        entityId: attemptId,
        meta: { model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens },
      },
    });
    revalidatePath(`/hr/natijalar/${attemptId}`);
    return { ok: true, message: r.stored.warnings.length ? "Tahlil tayyor (ogohlantirish bilan)" : "Tahlil tayyor" };
  } catch (e) {
    return { ok: false, message: describe(e) };
  }
}
