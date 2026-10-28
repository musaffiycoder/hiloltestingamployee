"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAssessmentByToken, isExpired } from "@/lib/attempt-access";
import { computeAttempt } from "@/lib/attempt";
import { buildQuestionSet } from "@/lib/test-config";
import { allow } from "@/lib/rate-limit";
import { sectionOf, timingOf, type Timing } from "@/lib/sections";

export async function startAttempt(token: string, form: FormData) {
  if (!(await allow(`start:${token}`, 30, 3600))) redirect(`/t/${token}`);
  const a = await getAssessmentByToken(token);
  if (!a || isExpired(a)) redirect(`/t/${token}`);
  if (form.get("consent") !== "on") redirect(`/t/${token}?consent=required`);
  if (a.status === "SUBMITTED") redirect(`/t/${token}/done`);

  const current = a.attempts[0];
  if (!current || current.finishedAt) {
    // Savollar test konstruktori sozlamasi bo'yicha tanlanadi (sozlanmagan bo'lsa — hamma faol savol)
    const set = await buildQuestionSet(a.positionId);
    await db.attempt.create({
      data: {
        assessmentId: a.id,
        consentAt: new Date(),
        questionIds: set.questionIds,
        timeLimitSec: set.timeLimitSec,
        closedTimeSec: set.closedTimeSec,
        openTimeSec: set.openTimeSec,
      },
    });
    await db.assessment.update({ where: { id: a.id }, data: { status: "STARTED" } });
  }
  redirect(`/t/${token}/test`);
}

const answerSchema = z.object({
  questionId: z.string().min(1),
  selected: z.union([z.number().int().min(0).max(20), z.array(z.number().int().min(0).max(20)).max(20), z.null()]).optional(),
  text: z.string().max(8000).optional(),
  timeMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
});

async function activeAttempt(token: string) {
  const a = await getAssessmentByToken(token);
  const attempt = a?.attempts[0];
  if (!a || !attempt || attempt.finishedAt || a.status === "SUBMITTED") return null;
  return { assessment: a, attempt };
}

type ActiveAttempt = NonNullable<Awaited<ReturnType<typeof activeAttempt>>>["attempt"];

/** Urinishning joriy bo'limi va qolgan vaqti (eski urinishlarda — bitta umumiy vaqt). */
async function attemptTiming(attempt: ActiveAttempt): Promise<Timing> {
  const ids = (attempt.questionIds as string[] | null) ?? [];
  const fallback =
    attempt.timeLimitSec === null && attempt.closedTimeSec === null && attempt.openTimeSec === null
      ? (await db.question.findMany({ where: { id: { in: ids } }, select: { timeLimitSec: true } })).reduce((sum, q) => sum + q.timeLimitSec, 0)
      : 0;
  return timingOf(attempt, fallback);
}

// Vaqt tugash chegarasida yuborilgan oxirgi javob qabul qilinadi
const GRACE_SEC = 15;

export async function saveResponse(token: string, input: unknown) {
  if (!(await allow(`save:${token}`, 400, 3600))) return { ok: false as const };
  const ctx = await activeAttempt(token);
  if (!ctx) return { ok: false as const };
  const data = answerSchema.parse(input);
  if (!(ctx.attempt.questionIds as string[]).includes(data.questionId)) return { ok: false as const };

  // Bo'limlar: test bo'limidan o'tilgach uning javoblari o'zgarmaydi, yozma savollar o'z bo'limida ochiladi
  const timing = await attemptTiming(ctx.attempt);
  if (timing.mode === "sections") {
    const q = await db.question.findUnique({ where: { id: data.questionId }, select: { type: true } });
    const sec = q ? sectionOf(q.type) : null;
    const lateClosed =
      sec === "closed" && timing.phase === "open" && !ctx.attempt.openStartedAt && Date.now() - timing.closedEnd < GRACE_SEC * 1000;
    if (sec !== timing.phase && !lateClosed) return { ok: false as const };
  }

  const payload = { selected: data.selected ?? null, text: data.text ?? "" };
  await db.response.upsert({
    where: { attemptId_questionId: { attemptId: ctx.attempt.id, questionId: data.questionId } },
    create: { attemptId: ctx.attempt.id, questionId: data.questionId, payload, timeMs: data.timeMs ?? 0 },
    // Vaqt yig'iladi: nomzod savolga bir necha marta qaytishi mumkin
    update: { payload, timeMs: { increment: data.timeMs ?? 0 }, score: null, scoreSource: null, reviewed: false },
  });
  return { ok: true as const };
}

/**
 * Serverdagi qolgan vaqt (soniya) va joriy bo'lim: HR testni uzaytirsa, ochiq sahifa ham yangi vaqtni oladi;
 * test bo'limi vaqti tugasa, sahifa yozma bo'limga o'tadi.
 */
export async function remainingTime(token: string): Promise<{ left: number; phase: "closed" | "open" | null; hasOpen: boolean } | null> {
  const ctx = await activeAttempt(token);
  if (!ctx) return null;
  const t = await attemptTiming(ctx.attempt);
  return t.mode === "single" ? { left: t.left, phase: null, hasOpen: false } : { left: t.left, phase: t.phase, hasOpen: t.hasOpen };
}

/** Nomzod test bo'limini yakunlab, yozma savollarga o'tadi. Ortga qaytib bo'lmaydi. */
export async function startOpenSection(token: string) {
  const ctx = await activeAttempt(token);
  if (!ctx) return { ok: false as const };
  const t = await attemptTiming(ctx.attempt);
  if (t.mode !== "sections") return { ok: false as const };
  if (!ctx.attempt.openStartedAt) {
    await db.attempt.update({
      where: { id: ctx.attempt.id },
      data: { openStartedAt: new Date(Math.min(Date.now(), t.closedEnd)) },
    });
  }
  return { ok: true as const, hasOpen: t.hasOpen };
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
  // Yakunlash bosilishi bilan AI ishga tushadi: ochiq javoblar baholanadi, so'ng chuqur tahlil yoziladi.
  // Nomzod kutib o'tirmaydi (after) — natija tayyor bo'lganda HR sahifasida paydo bo'ladi.
  const attemptId = ctx.attempt.id;
  after(async () => {
    const deadline = Date.now() + 285_000;
    try {
      const { aiConfigured } = await import("@/lib/ai/client");
      if (!aiConfigured()) return;
      const { generateAnalysis, gradeOpenAnswers } = await import("@/lib/ai/review");
      await gradeOpenAnswers(attemptId);
      await generateAnalysis(attemptId, { deadline });
    } catch (err) {
      console.error("auto AI pipeline failed", err);
    }
  });
  redirect(`/t/${token}/done`);
}
