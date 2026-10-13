import "server-only";
import { db } from "./db";
import {
  evaluate,
  scoreMcqMulti,
  scoreMcqSingle,
  scoreSituational,
  type ScoredItem,
} from "./scoring";

type AnswerKey = { correct?: number | number[] } | null;
type Payload = { options?: ({ text: string; points: number } | string)[] } | null;

/** Avtomatik baholanadigan savol uchun 0..1 ball; qo'lda ko'rib chiqish kerak bo'lsa null. */
export function autoScore(
  type: string,
  answerKey: unknown,
  payload: unknown,
  response: unknown,
): number | null {
  const r = (response ?? {}) as { selected?: number | number[] | null; text?: string };
  const key = answerKey as AnswerKey;
  const pl = payload as Payload;
  switch (type) {
    case "MCQ_SINGLE":
      return scoreMcqSingle(typeof r.selected === "number" ? r.selected : null, Number(key?.correct));
    case "MCQ_MULTI":
      return scoreMcqMulti(Array.isArray(r.selected) ? r.selected : [], Array.isArray(key?.correct) ? key!.correct : []);
    case "SITUATIONAL": {
      const opts = (pl?.options ?? []) as { points: number }[];
      return scoreSituational(typeof r.selected === "number" ? r.selected : null, opts);
    }
    case "OPEN":
      return r.text && r.text.trim().length > 0 ? null : 0;
    default:
      return null;
  }
}

/** Urinishni qayta hisoblaydi: javob ballari → kompetensiya darajalari → natija. */
export async function computeAttempt(attemptId: string) {
  const attempt = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      assessment: { include: { position: { include: { competencies: { orderBy: { sortOrder: "asc" } } } } } },
      responses: true,
    },
  });
  const qids = attempt.questionIds as string[];
  const questions = await db.question.findMany({ where: { id: { in: qids } } });
  const resByQ = new Map(attempt.responses.map((r) => [r.questionId, r]));

  const items: Record<string, ScoredItem[]> = {};
  const redFlags: { t: string; q: string; question: string }[] = [];
  let needsReview = false;

  for (const q of questions) {
    const res = resByQ.get(q.id);
    let score: number | null;
    if (res) {
      if (res.reviewed && res.score !== null) {
        score = res.score;
      } else {
        score = autoScore(q.type, q.answerKey, q.payload, res.payload);
        if (res.score !== score || res.scoreSource !== (score === null ? null : "auto")) {
          await db.response.update({
            where: { id: res.id },
            data: { score, scoreSource: score === null ? null : "auto" },
          });
        }
      }
    } else {
      score = 0; // javob berilmagan
    }
    if (res && q.type === "SITUATIONAL") {
      const sel = (res.payload as { selected?: number | null })?.selected;
      const opts = ((q.payload as { options?: { text: string; flag?: boolean }[] })?.options ?? []);
      if (typeof sel === "number" && opts[sel]?.flag) {
        redFlags.push({ t: "Xavfli xatti-harakat tanlandi", q: opts[sel].text, question: q.stem });
      }
    }
    if (score === null) {
      needsReview = true;
      continue;
    }
    (items[q.competencyId] ??= []).push({ level: q.level, score });
  }

  const defs = attempt.assessment.position.competencies
    // faqat savoli bor kompetensiyalar baholanadi
    .filter((c) => questions.some((q) => q.competencyId === c.id))
    .map((c) => ({ id: c.id, code: c.code, name: c.name, target: c.target, weight: c.weight, critical: c.critical }));

  const ev = evaluate(defs, items, { redFlags: redFlags.length });

  await db.$transaction(async (tx) => {
    await tx.competencyScore.deleteMany({ where: { attemptId } });
    for (const c of ev.competencies) {
      if (c.level === null) continue;
      const arr = items[c.id] ?? [];
      await tx.competencyScore.create({
        data: {
          attemptId,
          competencyId: c.id,
          level: c.level,
          answered: arr.length,
          correctRatio: arr.length ? arr.reduce((s, x) => s + x.score, 0) / arr.length : 0,
        },
      });
    }
    const existing = await tx.attemptResult.findUnique({ where: { attemptId } });
    const data = {
      overallPct: ev.overallPct,
      verdict: ev.verdict,
      criticalFail: ev.criticalFail,
      redFlags,
      needsReview: needsReview || ev.unscored.length > 0,
    };
    if (existing) await tx.attemptResult.update({ where: { attemptId }, data });
    else await tx.attemptResult.create({ data: { attemptId, ...data } });
  });

  return ev;
}
