import "server-only";
import { db } from "@/lib/db";
import { costUsd } from "./pricing";
import { computeAttempt } from "@/lib/attempt";
import { aiEffort, aiModels, callJson, type AiClient } from "./client";
import {
  analysisPart1JsonSchema,
  analysisPart1Schema,
  analysisPart2JsonSchema,
  analysisPart2Schema,
  analysisSchema,
  gradeJsonSchema,
  gradeSchema,
  type StoredAnalysis,
} from "./schemas";
import { analysisPrompt, findUnknownPercents, gradePrompt, MIN_OPEN_ANSWER_CHARS, type AnalysisInput } from "./prompts";
import { combineGrades } from "./combine";
import { validateAnalysis } from "./quality";

type Opt = string | { text: string; points?: number; flag?: boolean };
const optText = (o: Opt) => (typeof o === "string" ? o : o.text);

export type GradingSummary = {
  graded: number;
  tooShort: number;
  noRubric: number;
  lowConfidence: number;
  disagreement: number;
  injection: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
};

/** 1-bosqich: ochiq javoblarni AI baholaydi; qisqa (<15 belgi) javob API'siz 0 ball. Ballar darhol saqlanadi. */
export async function gradeOpenAnswers(attemptId: string, client?: AiClient): Promise<GradingSummary> {
  const responses = await db.response.findMany({
    where: { attemptId, question: { type: "OPEN" } },
    include: { question: true },
  });
  const summary: GradingSummary = { graded: 0, tooShort: 0, noRubric: 0, lowConfidence: 0, disagreement: 0, injection: 0, failed: 0, inputTokens: 0, outputTokens: 0 };

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
      // Ikki mustaqil baholovchi (A/B): kelishmasa — odamga yo'naltiriladi
      const input = { stem: r.question.stem, level: r.question.level, rubric, answer: text, explanation: r.question.explanation };
      const run = (variant: "A" | "B") => {
        const p = gradePrompt(input, variant);
        return callJson({
          model: aiModels().grader,
          system: p.system,
          user: p.user,
          jsonSchema: gradeJsonSchema,
          parse: (x) => gradeSchema.parse(x),
          maxTokens: 12000,
          effort: aiEffort().grader,
          // Uzun keys va javoblar (jadval, hisob) uchun: 45 s yetmasligi mumkin
          timeoutMs: 120_000,
          client,
        });
      };
      let ra, rb;
      try {
        [ra, rb] = await Promise.all([run("A"), run("B")]);
      } catch (e) {
        // Bitta javob xatosi butun jarayonni to'xtatmasin: javob odam tekshiruviga qoladi, tahlil davom etadi
        console.error("grade failed", r.id, (e as Error).message);
        summary.failed++;
        continue;
      }
      const c = combineGrades(ra.data, rb.data);
      await db.response.update({
        where: { id: r.id },
        data: {
          score: c.score,
          aiScore: c.score,
          scoreSource: "ai",
          rationale: c.rationale,
          confidence: c.confidence,
          flagged: c.injectionAttempt || r.flagged,
        },
      });
      summary.graded++;
      if (c.confidence < 0.6) summary.lowConfidence++;
      if (c.disagreement) summary.disagreement++;
      if (c.injectionAttempt) summary.injection++;
      summary.inputTokens += ra.inputTokens + rb.inputTokens;
      summary.outputTokens += ra.outputTokens + rb.outputTokens;
    }
  };
  // Hamma ochiq javob bir vaqtda (8 tagacha): tahlilga vaqt qolishi uchun
  await Promise.all(Array.from({ length: Math.min(8, todo.length) }, worker));

  await computeAttempt(attemptId);
  await logUsage(attemptId, "grade", aiModels().grader, summary.inputTokens, summary.outputTokens);
  return summary;
}

/** AI sarfini qayd etish (analitika). Xato asosiy jarayonni to'xtatmaydi. */
async function logUsage(attemptId: string, kind: "grade" | "analysis", model: string, inputTokens: number, outputTokens: number) {
  if (inputTokens + outputTokens === 0) return;
  try {
    await db.aiUsage.create({ data: { attemptId, kind, model, inputTokens, outputTokens, costUsd: costUsd(model, inputTokens, outputTokens) } });
  } catch {}
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
      // Uzun keys matni tahlil so'rovini og'irlashtirmasin (ochiq savol to'liq qoladi)
      stem: q.type !== "OPEN" && q.stem.length > 1200 ? `${q.stem.slice(0, 1200)}…` : q.stem,
      score: r.score,
      scoreSource: r.scoreSource,
      rationale: r.rationale,
      confidence: r.confidence,
      timeSec: Math.round(r.timeMs / 1000),
      limitSec: q.timeLimitSec,
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

  // Qiyoslash: shu lavozim va rejim bo'yicha boshqalar (kamida 3 kishi bo'lsa)
  const others = await db.attemptResult.findMany({
    where: {
      attemptId: { not: attemptId },
      attempt: { assessment: { positionId: assessment.positionId, mode: assessment.mode } },
    },
    select: { overallPct: true },
  });
  const cohort = others.length >= 3 ? { avgPct: others.reduce((s, o) => s + o.overallPct, 0) / others.length, n: others.length } : null;

  // Kompetensiya bo'yicha boshqalarning o'rtacha darajasi (kamida 3 kishi)
  const otherScores = await db.competencyScore.findMany({
    where: {
      attemptId: { not: attemptId },
      attempt: { assessment: { positionId: assessment.positionId, mode: assessment.mode }, result: { isNot: null } },
    },
    select: { competencyId: true, level: true },
  });
  const cohortLevelBy = new Map<string, number>();
  {
    const acc = new Map<string, number[]>();
    for (const o of otherScores) acc.set(o.competencyId, [...(acc.get(o.competencyId) ?? []), o.level]);
    for (const [k, v] of acc) if (v.length >= 3) cohortLevelBy.set(k, v.reduce((x, y) => x + y, 0) / v.length);
  }

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
    positionCode: assessment.position.code,
    mode: assessment.mode,
    positionTitle: assessment.position.title,
    overallPct: result.overallPct,
    requiredPct,
    weightedLevel: (() => {
      const scored = comps.filter((c) => levelBy.get(c.id) != null);
      const w = scored.reduce((x, c) => x + c.weight, 0);
      return w ? scored.reduce((x, c) => x + (levelBy.get(c.id) as number) * c.weight, 0) / w : null;
    })(),
    criticalFail: result.criticalFail,
    needsReview: result.needsReview,
    competencies: comps.map((c) => {
      const answered = attempt.responses.filter((r) => r.question.competencyId === c.id).length;
      return {
        code: c.code,
        name: c.name,
        type: c.type,
        target: c.target,
        level: levelBy.get(c.id) ?? null,
        critical: c.critical,
        weight: c.weight,
        answered,
        reliability: answered >= 4 ? ("yuqori" as const) : answered >= 2 ? ("o'rta" as const) : ("past" as const),
        cohortLevel: cohortLevelBy.get(c.id) ?? null,
      };
    }),
    questions,
    timing: { spentMin, avgSec, fastCount: times.filter((t) => t < 20000).length, total: ordered.length },
    conditions: {
      allowedMin: attempt.timeLimitSec ? Math.round(attempt.timeLimitSec / 60) : Math.round(ordered.reduce((x, r) => x + r.question.timeLimitSec, 0) / 60),
      unanswered: questions.filter((q) => q.type === "OPEN" ? !q.answer?.trim() : q.chosen === undefined).length,
      focusLost: attempt.signals.filter((x) => x.type === "focus_lost").length,
      paste: attempt.signals.filter((x) => x.type === "paste").length,
      medianSec: (() => {
        const t = times.slice().sort((x, y) => x - y);
        return t.length ? t[Math.floor(t.length / 2)] / 1000 : 0;
      })(),
      openWords: questions.reduce((x, q) => x + (q.type === "OPEN" && q.answer ? q.answer.trim().split(/\s+/).filter(Boolean).length : 0), 0),
    },
    cohort,
    history,
    hrContext: result.hrContext?.trim() || null,
    redFlags,
    signals: signalCounts,
  };

  const allowedPercents = [
    result.overallPct,
    requiredPct,
    ...(cohort ? [cohort.avgPct] : []),
    ...history.map((h) => h.pct),
    ...comps.map((c) => c.weight),
    0, 25, 50, 75, 100,
    ...questions.flatMap((q) => (q.score === null ? [] : [q.score * 100])),
  ];
  return { input, allowedPercents, answers: ordered.length, cohortN: cohort?.n ?? 0 };
}

export type AnalysisOptions = {
  client?: AiClient;
  /** Jami vaqt chegarasi (epoch ms). Standart: hozir + 285 s. */
  deadline?: number;
  /** Faqat natijani qaytaradi, bazaga yozmaydi (solishtirish skripti uchun). */
  save?: boolean;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
};

/** 3-bosqich: chuqur tahlil. Natijani `AttemptResult.analysis` ga yozadi. */
export async function generateAnalysis(attemptId: string, clientOrOpts?: AiClient | AnalysisOptions) {
  const opts: AnalysisOptions =
    clientOrOpts && "messages" in clientOrOpts ? { client: clientOrOpts } : ((clientOrOpts as AnalysisOptions | undefined) ?? {});
  const deadline = opts.deadline ?? Date.now() + 285_000;
  const { input, allowedPercents, answers, cohortN } = await buildAnalysisInput(attemptId);
  const p = analysisPrompt(input);
  const effort = opts.effort ?? aiEffort().analysis;

  const P1 = "xulosa (executiveSummary), overallNarrative, SWOT (strengths, weaknesses, opportunities, threats, swotStrategy), answerPatterns, competencyInsights, keyConcerns, recommendation va recommendationReasons";
  const P2 = "errorDiagnostics, interviewQuestions, roleRisks, developmentPlan va dataGaps";
  const part = (n: 1 | 2, eff: typeof effort, user: string, timeoutMs: number) => {
    const common = {
      model: aiModels().analysis,
      system: p.system,
      user: `${user}\n\n(Bu so'rovda FAQAT shu maydonlarni to'ldir: ${n === 1 ? P1 : P2}. Qolgan bo'limlar alohida so'rovda yoziladi.)`,
      maxTokens: 32000,
      stream: true,
      effort: eff,
      timeoutMs,
      retries: 0,
      client: opts.client,
    };
    return n === 1
      ? callJson({ ...common, jsonSchema: analysisPart1JsonSchema, parse: (x) => analysisPart1Schema.parse(x) })
      : callJson({ ...common, jsonSchema: analysisPart2JsonSchema, parse: (x) => analysisPart2Schema.parse(x) });
  };
  // Ikki qism parallel yoziladi (tezroq va har biri strukturali chiqish chegarasiga sig'adi)
  const run = async (eff: typeof effort, user: string, timeoutMs: number) => {
    const [r1, r2] = await Promise.all([part(1, eff, user, timeoutMs), part(2, eff, user, timeoutMs)]);
    return {
      data: analysisSchema.parse({ ...r1.data, ...r2.data }),
      inputTokens: r1.inputTokens + r2.inputTokens,
      outputTokens: r1.outputTokens + r2.outputTokens,
      model: r1.model,
    };
  };

  let res = await run(effort, p.user, Math.max(30_000, Math.min(200_000, deadline - Date.now() - 2_000)));
  let issues = validateAnalysis(res.data, input);
  let escalated = false;

  // Sifat darvozasi: yaroqsiz bo'lsa va vaqt qolgan bo'lsa — `high` bilan, kamchiliklarni ko'rsatib qayta yozdiramiz
  const left = deadline - Date.now();
  if (issues.length > 0 && effort !== "high" && left > 70_000) {
    const feedback = `${p.user}\n\nOLDINGI JAVOBDAGI KAMCHILIKLAR (tuzat, qolgan qismini saqla):\n${issues.map((x) => `- ${x}`).join("\n")}`;
    const retry = await run("high", feedback, left - 3_000);
    const retryIssues = validateAnalysis(retry.data, input);
    if (retryIssues.length <= issues.length) {
      res = { ...retry, inputTokens: res.inputTokens + retry.inputTokens, outputTokens: res.outputTokens + retry.outputTokens };
      issues = retryIssues;
      escalated = true;
    }
  }

  const a = res.data;
  const texts = [
    a.overallNarrative,
    ...a.strengths,
    ...a.weaknesses,
    ...a.opportunities,
    ...a.threats,
    a.executiveSummary,
    ...Object.values(a.answerPatterns),
    ...a.competencyInsights.flatMap((c) => [c.analysis, c.evidence, c.nextStep]),
    ...a.errorDiagnostics.flatMap((e) => [e.shows, e.fix]),
    ...a.interviewQuestions.flatMap((i) => [i.question, i.lookFor]),
    ...a.roleRisks,
    ...a.developmentPlan.flatMap((d) => [d.recommendation, d.successMetric, ...d.resources.map((r) => r.why)]),
    a.swotStrategy,
    ...a.dataGaps.flatMap((g) => [g.gap, g.why, g.howToClose]),
    a.recommendation,
    ...a.recommendationReasons,
  ];
  const unknown = findUnknownPercents(texts, allowedPercents);
  const stored: StoredAnalysis = {
    ...a,
    developmentPlan: a.developmentPlan.slice().sort((x, y) => x.priority - y.priority),
    warnings: [
      ...(unknown.length ? [`Matnda formulada yo'q foiz uchradi: ${unknown.join(", ")} — tekshirib ko'ring`] : []),
      ...issues.map((x) => `Tekshiruv: ${x}`),
    ],
    generatedFrom: { answers, cohortN },
  };

  if (opts.save !== false) {
    await db.attemptResult.update({
      where: { attemptId },
      data: { analysis: stored as unknown as object, analysisAt: new Date(), analysisModel: res.model },
    });
  }
  await logUsage(attemptId, "analysis", res.model, res.inputTokens, res.outputTokens);
  return { stored, inputTokens: res.inputTokens, outputTokens: res.outputTokens, model: res.model, issues, escalated };
}
