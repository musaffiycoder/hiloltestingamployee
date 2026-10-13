import "server-only";
import { db } from "@/lib/db";
import { computeAttempt } from "@/lib/attempt";
import { VERDICTS } from "@/lib/labels";
import type { VerdictKey } from "@/lib/scoring";
import { aiModels, callJson, type AiClient } from "./client";
import { analysisJsonSchema, analysisSchema, gradeJsonSchema, gradeSchema, type StoredAnalysis } from "./schemas";
import { analysisPrompt, findUnknownPercents, gradePrompt, MIN_OPEN_ANSWER_CHARS, type AnalysisInput } from "./prompts";

type Opt = string | { text: string; points?: number; flag?: boolean };
const optText = (o: Opt) => (typeof o === "string" ? o : o.text);

export type GradingSummary = {
  graded: number;
  tooShort: number;
  noRubric: number;
  lowConfidence: number;
  injection: number;
  inputTokens: number;
  outputTokens: number;
};

/** 1-bosqich: ochiq javoblarni AI baholaydi; qisqa (<15 belgi) javob API'siz 0 ball. Ballar darhol saqlanadi. */
export async function gradeOpenAnswers(attemptId: string, client?: AiClient): Promise<GradingSummary> {
  const responses = await db.response.findMany({
    where: { attemptId, question: { type: "OPEN" } },
    include: { question: true },
  });
  const summary: GradingSummary = { graded: 0, tooShort: 0, noRubric: 0, lowConfidence: 0, injection: 0, inputTokens: 0, outputTokens: 0 };

  const todo = responses.filter((r) => r.scoreSource !== "human" && !r.reviewed);
  const queue = [...todo];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const text = ((r.payload as { text?: string })?.text ?? "").trim();
      const rubric = (r.question.rubric as { points?: string[] } | null)?.points ?? [];

      if (text.length < MIN_OPEN_ANSWER_CHARS) {
        await db.response.update({
          where: { id: r.id },
          data: { score: 0, scoreSource: "auto", rationale: `Javob juda qisqa (${text.length} belgi) — AI'ga yuborilmadi`, confidence: 1 },
        });
        summary.tooShort++;
        continue;
      }
      if (rubric.length === 0) {
        summary.noRubric++;
        continue;
      }
      const p = gradePrompt({ stem: r.question.stem, level: r.question.level, rubric, answer: text });
      const res = await callJson({
        model: aiModels().grader,
        system: p.system,
        user: p.user,
        jsonSchema: gradeJsonSchema,
        parse: (x) => gradeSchema.parse(x),
        maxTokens: 1200,
        effort: "low",
        client,
      });
      const g = res.data;
      await db.response.update({
        where: { id: r.id },
        data: {
          score: Math.round(g.score * 4) / 4,
          scoreSource: "ai",
          rationale: g.rationale,
          confidence: g.confidence,
          flagged: g.injectionAttempt || r.flagged,
        },
      });
      summary.graded++;
      if (g.confidence < 0.6) summary.lowConfidence++;
      if (g.injectionAttempt) summary.injection++;
      summary.inputTokens += res.inputTokens;
      summary.outputTokens += res.outputTokens;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker));

  await computeAttempt(attemptId);
  return summary;
}

export async function buildAnalysisInput(attemptId: string): Promise<{ input: AnalysisInput; allowedPercents: number[]; answers: number; cohortN: number }> {
  const attempt = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      assessment: { include: { position: { include: { competencies: { orderBy: { sortOrder: "asc" } } } } } },
      result: true,
      scores: true,
      signals: true,
      responses: { include: { question: { include: { competency: true } } } },
    },
  });
  if (!attempt.result) throw new Error("Natija hali hisoblanmagan");
  const { assessment, result } = attempt;

  const levelBy = new Map(attempt.scores.map((s) => [s.competencyId, s.level]));
  const asked = new Set(attempt.responses.map((r) => r.question.competencyId));
  const comps = assessment.position.competencies.filter((c) => asked.has(c.id));
  const wSum = comps.reduce((s, c) => s + c.weight, 0) || 1;
  const requiredPct = Math.round((comps.reduce((s, c) => s + c.target * c.weight, 0) / (5 * wSum)) * 100);

  const ordered = attempt.responses
    .slice()
    .sort((a, b) => a.question.competency.sortOrder - b.question.competency.sortOrder || a.question.level - b.question.level);

  const questions: AnalysisInput["questions"] = ordered.map((r, i) => {
    const q = r.question;
    const pl = (r.payload ?? {}) as { selected?: number | number[] | null; text?: string };
    const opts = ((q.payload as { options?: Opt[] })?.options ?? []) as Opt[];
    const key = (q.answerKey as { correct?: number | number[] } | null)?.correct;
    const base = {
      n: i + 1,
      comp: `${q.competency.code} ${q.competency.name}`,
      level: q.level,
      type: q.type,
      stem: q.stem,
      score: r.score,
      scoreSource: r.scoreSource,
      rationale: r.rationale,
      confidence: r.confidence,
      timeSec: Math.round(r.timeMs / 1000),
    };
    if (q.type === "OPEN") {
      return { ...base, answer: pl.text ?? "", rubric: (q.rubric as { points?: string[] } | null)?.points ?? [] };
    }
    if (q.type === "SITUATIONAL") {
      const sel = typeof pl.selected === "number" ? pl.selected : null;
      const best = opts.reduce<{ i: number; p: number }>((b, o, k) => ((typeof o === "object" ? (o.points ?? 0) : 0) > b.p ? { i: k, p: typeof o === "object" ? (o.points ?? 0) : 0 } : b), { i: -1, p: -1 });
      const chosen = sel !== null ? opts[sel] : undefined;
      return {
        ...base,
        correct: best.i >= 0 ? optText(opts[best.i]) : undefined,
        chosen: chosen ? optText(chosen) : undefined,
        points: chosen && typeof chosen === "object" ? chosen.points : undefined,
        flagged: !!(chosen && typeof chosen === "object" && chosen.flag),
      };
    }
    const selArr = Array.isArray(pl.selected) ? pl.selected : typeof pl.selected === "number" ? [pl.selected] : [];
    const keyArr = Array.isArray(key) ? key : typeof key === "number" ? [key] : [];
    return {
      ...base,
      chosen: selArr.length ? selArr.map((k) => optText(opts[k])).join(" · ") : undefined,
      correct: keyArr.map((k) => optText(opts[k])).join(" · "),
      isCorrect: selArr.length === keyArr.length && selArr.every((k) => keyArr.includes(k)),
    };
  });

  const times = ordered.map((r) => r.timeMs);
  const avgSec = times.length ? times.reduce((s, x) => s + x, 0) / times.length / 1000 : 0;
  const spentMin =
    attempt.finishedAt ? Math.max(1, Math.round((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 60000)) : null;

  // Qiyoslash: shu lavozim va rejim bo'yicha boshqalar (kamida 5 kishi bo'lsa)
  const others = await db.attemptResult.findMany({
    where: {
      attemptId: { not: attemptId },
      attempt: { assessment: { positionId: assessment.positionId, mode: assessment.mode } },
    },
    select: { overallPct: true },
  });
  const cohort = others.length >= 5 ? { avgPct: others.reduce((s, o) => s + o.overallPct, 0) / others.length, n: others.length } : null;

  const prev = await db.attemptResult.findMany({
    where: {
      attemptId: { not: attemptId },
      attempt: { assessment: { positionId: assessment.positionId, subjectName: assessment.subjectName } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { overallPct: true, createdAt: true },
  });
  const history = prev.map((p) => ({ date: p.createdAt.toISOString().slice(0, 10), pct: p.overallPct }));

  const signalCounts = Object.entries(
    attempt.signals.reduce<Record<string, number>>((m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m), {}),
  ).map(([type, n]) => ({ type, n }));

  const redFlags = (Array.isArray(result.redFlags) ? result.redFlags : []) as { t: string; q: string }[];

  const input: AnalysisInput = {
    mode: assessment.mode,
    positionTitle: assessment.position.title,
    verdictLabel: VERDICTS[result.verdict as VerdictKey].label,
    overallPct: result.overallPct,
    requiredPct,
    criticalFail: result.criticalFail,
    needsReview: result.needsReview,
    competencies: comps.map((c) => ({
      code: c.code,
      name: c.name,
      type: c.type,
      target: c.target,
      level: levelBy.get(c.id) ?? null,
      critical: c.critical,
      answered: attempt.responses.filter((r) => r.question.competencyId === c.id).length,
    })),
    questions,
    timing: { spentMin, avgSec, fastCount: times.filter((t) => t < 20000).length, total: ordered.length },
    cohort,
    history,
    redFlags,
    signals: signalCounts,
  };

  const allowedPercents = [
    result.overallPct,
    requiredPct,
    ...(cohort ? [cohort.avgPct] : []),
    ...history.map((h) => h.pct),
    0, 25, 50, 75, 100,
    ...questions.flatMap((q) => (q.score === null ? [] : [q.score * 100])),
  ];
  return { input, allowedPercents, answers: ordered.length, cohortN: cohort?.n ?? 0 };
}

/** 3-bosqich: chuqur tahlil. Natijani `AttemptResult.analysis` ga yozadi. */
export async function generateAnalysis(attemptId: string, client?: AiClient) {
  const { input, allowedPercents, answers, cohortN } = await buildAnalysisInput(attemptId);
  const p = analysisPrompt(input);
  const res = await callJson({
    model: aiModels().analysis,
    system: p.system,
    user: p.user,
    jsonSchema: analysisJsonSchema,
    parse: (x) => analysisSchema.parse(x),
    maxTokens: 8000,
    effort: "medium",
    client,
  });

  const a = res.data;
  const texts = [
    a.overallNarrative,
    ...a.strengths,
    ...a.weaknesses,
    ...a.opportunities,
    ...a.threats,
    ...Object.values(a.answerPatterns),
    ...a.competencyInsights.map((c) => c.analysis),
    ...a.developmentPlan.map((d) => d.recommendation),
    a.recommendation,
  ];
  const unknown = findUnknownPercents(texts, allowedPercents);
  const stored: StoredAnalysis = {
    ...a,
    developmentPlan: a.developmentPlan.slice().sort((x, y) => x.priority - y.priority),
    warnings: unknown.length ? [`Matnda formulada yo'q foiz uchradi: ${unknown.join(", ")} — tekshirib ko'ring`] : [],
    generatedFrom: { answers, cohortN },
  };

  await db.attemptResult.update({
    where: { attemptId },
    data: { analysis: stored as unknown as object, analysisAt: new Date(), analysisModel: res.model },
  });
  return { stored, inputTokens: res.inputTokens, outputTokens: res.outputTokens, model: res.model };
}
