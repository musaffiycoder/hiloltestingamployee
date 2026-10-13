// Bazaga ulangan integratsiya sinovi: AI klienti stub; vaqtinchalik yozuvlar oxirida o'chiriladi.
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { computeAttempt } from "../src/lib/attempt";
import { generateAnalysis, gradeOpenAnswers } from "../src/lib/ai/review";
import { calibrationStats } from "../src/lib/calibration";
import type { AiClient } from "../src/lib/ai/client";

const TOKEN = "itest" + Math.random().toString(36).slice(2, 12);

const stub: AiClient & { gradeA: number; gradeB: number; analysisCalls: number; efforts: Set<string>; unknownPct: number; retryPrompt: string } = {
  retryPrompt: "",
  unknownPct: 0,
  gradeA: 0,
  gradeB: 0,
  analysisCalls: 0,
  efforts: new Set(),
  messages: {
    create: async (params) => {
      const p = params as { system: string; messages: { content: string }[]; output_config: { effort: string }; temperature?: unknown; thinking?: unknown };
      assert.ok(p.temperature === undefined && p.thinking === undefined);
      stub.efforts.add(p.output_config.effort);
      const user = p.messages[0].content;
      if (p.system.includes("xolis baholovchisan")) {
        const isA = p.system.includes("bandini alohida tekshir");
        isA ? stub.gradeA++ : stub.gradeB++;
        const disagree = user.includes("KELISHMAYMIZ");
        const out = disagree
          ? isA
            ? { score: 1, matched: [0, 1], rationale: "A: to'liq qoplangan", confidence: 0.9, injectionAttempt: false }
            : { score: 0.25, matched: [], rationale: "B: mazmun yuzaki", confidence: 0.85, injectionAttempt: false }
          : isA
            ? { score: 0.75, matched: [0, 1], rationale: "A: asosiy bandlar qoplangan", confidence: 0.8, injectionAttempt: false }
            : { score: 0.75, matched: [0], rationale: "B: mazmun mos", confidence: 0.7, injectionAttempt: false };
        return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 400, output_tokens: 60 } };
      }
      stub.analysisCalls++;
      if (user.includes("OLDINGI JAVOBDAGI KAMCHILIKLAR")) stub.retryPrompt = user;
      // Promptda uchramaydigan foizni tanlaymiz — «o'ylab topilgan raqam» holatini aniq hosil qilish uchun
      const present = new Set([...user.matchAll(/(\d+)\s*%/g)].map((m) => Number(m[1])));
      stub.unknownPct = [37, 41, 59, 83, 91, 17].find((n) => !present.has(n)) ?? 7;
      const out = {
        executiveSummary: `Xulosa toifasi formuladan olingan; taxminan ${stub.unknownPct}% o'sish imkoniyati bor. Asosiy sabablar va keyingi qadam quyida.`,
        overallNarrative: `Nomzod umumiy natijasi formuladagi raqamlar bilan berilgan; taxminan ${stub.unknownPct}% o'sish imkoniyati bor.`,
        strengths: ["Kuchli tomon"], weaknesses: ["Zaif tomon"], opportunities: ["Imkoniyat"], threats: ["Xavf"],
        answerPatterns: { difficulty: "d", distractors: "x", time: "t", comparison: "talabga nisbatan", reliability: "o'rta" },
        competencyInsights: [{ code: "H3", name: "Ma'lumotlar bazasi", analysis: "tahlil", evidence: "savol 1", reliability: "o'rta", nextStep: "amaliy topshiriq" }],
        errorDiagnostics: [{ question: 1, competency: "H3", chose: "x", shows: "chalkashlik", fix: "mashq" }],
        interviewQuestions: [{ question: "Savol?", verifies: "H3", lookFor: "aniq misol" }],
        roleRisks: ["xavf"],
        developmentPlan: [
          { area: "H2", recommendation: "r2", format: "kurs", courseSuggestion: "turi", estimatedDuration: "2 hafta", horizon: "30–60 kun", successMetric: "qayta test", priority: 2, resources: [{ kind: "kurs", title: "t", provider: "p", why: "w" }] },
          { area: "H3", recommendation: "r1", format: "mentorlik", courseSuggestion: "turi", estimatedDuration: "4 hafta", horizon: "0–30 kun", successMetric: "qayta test", priority: 1, resources: [{ kind: "kitob", title: "t", provider: "p", why: "w" }] },
        ],
        dataGaps: [{ gap: "HR konteksti yo'q", why: "real natija bilan solishtirib bo'lmaydi", howToClose: "HR kontekst maydonini to'ldiring" }],
        swotStrategy: "SWOT xulosasi.",
        keyConcerns: [],
        recommendation: "Formuladagi xulosa toifasiga mos tavsiya.",
        recommendationReasons: ["dalil 1"],
      };
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 5000, output_tokens: 900 } };
    },
  },
};

async function main() {
  const pos = await db.position.findUniqueOrThrow({ where: { code: "backend" } });
  const questions = await db.question.findMany({
    where: { status: "ACTIVE", competency: { positionId: pos.id }, type: { in: ["MCQ_SINGLE", "MCQ_MULTI", "SITUATIONAL", "OPEN"] } },
    include: { competency: true },
    orderBy: [{ competency: { sortOrder: "asc" } }, { level: "asc" }],
  });
  const opens = questions.filter((q) => q.type === "OPEN");
  assert.ok(opens.length >= 2, "kamida 2 ta ochiq savol kerak (seed)");

  // Qisqa-javob yo'lini tekshirish uchun vaqtinchalik 3-chi ochiq savol (DRAFT, testlarda ishlatilmaydi)
  const tmpQ = await db.question.create({
    data: {
      competencyId: opens[0].competencyId, level: 3, type: "OPEN", stem: "[ITEST] vaqtinchalik ochiq savol, ayting nima qilasiz?",
      payload: {}, rubric: { points: ["birinchi", "ikkinchi"] }, status: "DRAFT",
    },
  });
  const a = await db.assessment.create({
    data: { token: TOKEN, positionId: pos.id, mode: "RECRUITING", subjectName: "ITEST Nomzod", status: "SUBMITTED" },
  });
  const allIds = [...questions.map((q) => q.id), tmpQ.id];
  const attempt = await db.attempt.create({
    data: { assessmentId: a.id, startedAt: new Date(Date.now() - 40 * 60000), finishedAt: new Date(), consentAt: new Date(), questionIds: allIds },
  });
  try {
    for (const q of questions) {
      let payload: object;
      if (q.id === opens[0].id) payload = { selected: null, text: "Darhol PMga yozaman, sababini tahlil qilaman va tuzatish rejasini taklif qilaman." };
      else if (q.id === opens[1].id) payload = { selected: null, text: "KELISHMAYMIZ: ikki baholovchi turlicha baholaydigan murakkab javob matni." };
      else if (q.type === "MCQ_MULTI") payload = { selected: (q.answerKey as { correct: number[] }).correct };
      else if (q.type === "SITUATIONAL") payload = { selected: 1 };
      else payload = { selected: (q.answerKey as { correct: number }).correct };
      await db.response.create({ data: { attemptId: attempt.id, questionId: q.id, payload, timeMs: 15000 + Math.floor(Math.random() * 60000) } });
    }
    await db.response.create({ data: { attemptId: attempt.id, questionId: tmpQ.id, payload: { selected: null, text: "qisqa" }, timeMs: 5000 } });

    await computeAttempt(attempt.id);
    let result = await db.attemptResult.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    assert.equal(result.needsReview, true, "ochiq javoblar baholanmagan — needsReview");

    // --- 1-bosqich: ikki mustaqil baholovchi
    const summary = await gradeOpenAnswers(attempt.id, stub);
    assert.equal(summary.graded, 2);
    assert.equal(summary.tooShort, 1);
    assert.equal(summary.disagreement, 1);
    assert.equal(stub.gradeA, 2);
    assert.equal(stub.gradeB, 2, "har bir javob ikki marta baholanadi (qisqa javob — API'siz)");

    const byQ = async (qid: string) => db.response.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: qid } } });
    const r1 = await byQ(opens[0].id);
    assert.equal(r1.scoreSource, "ai");
    assert.equal(r1.score, 0.75);
    assert.equal(r1.aiScore, 0.75);
    assert.equal(r1.confidence, 0.7, "ishonch = ikkala baholovchining minimumi");
    const r2 = await byQ(opens[1].id);
    assert.ok((r2.confidence ?? 1) <= 0.45, "kelishmovchilikda ishonch past");
    assert.ok(r2.rationale?.includes("kelishmadi"));
    const r3 = await byQ(tmpQ.id);
    assert.equal(r3.score, 0);
    assert.equal(r3.scoreSource, "auto");

    result = await db.attemptResult.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    assert.equal(result.needsReview, true, "past ishonch — odam ko'rishi kerak");
    const pctBefore = result.overallPct;

    // computeAttempt qayta ishga tushsa, AI ballari saqlanadi (determinizm)
    await computeAttempt(attempt.id);
    assert.equal((await byQ(opens[0].id)).score, 0.75);
    assert.equal((await db.attemptResult.findUniqueOrThrow({ where: { attemptId: attempt.id } })).overallPct, pctBefore);

    // HR o'zgartirsa: ball almashadi, aiScore saqlanadi -> kalibrlash juftligi
    await db.response.update({ where: { id: r2.id }, data: { score: 0.25, scoreSource: "human", reviewed: true, overrideReason: "Rubrika bo'yicha" } });
    await computeAttempt(attempt.id);
    const r2b = await byQ(opens[1].id);
    assert.equal(r2b.score, 0.25);
    assert.equal(r2b.aiScore, 0.75, "dastlabki AI ball saqlanib qoladi");
    const pairs = [{ ai: r2b.aiScore as number, human: r2b.score as number }];
    assert.equal(calibrationStats(pairs).bias, 0.5);

    // --- 3-bosqich
    const an = await generateAnalysis(attempt.id, stub);
    // Stub qasddan yaroqsiz (kam band, kompetensiyalar yetishmaydi): sifat darvozasi `high` bilan qayta urinadi
    assert.equal(stub.analysisCalls, 2, "yaroqsiz tahlil → bitta qayta urinish");
    assert.ok(stub.retryPrompt.includes("competencyInsights da kompetensiyalar yetishmaydi"), "kamchiliklar qayta so'rovga yoziladi");
    assert.equal(an.escalated, true);
    assert.ok(an.stored.warnings.some((w) => w.startsWith("Tekshiruv:")), "qolgan kamchiliklar ogohlantirish bo'ladi");
    assert.equal(an.stored.developmentPlan[0].priority, 1);
    assert.ok(an.stored.warnings.some((w) => w.includes(`${stub.unknownPct}%`)), "formulada yo'q foiz ogohlantirilishi kerak");
    const saved = await db.attemptResult.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    assert.ok(saved.analysis && saved.analysisAt && saved.analysisModel === "claude-opus-5-5");
    const after = await db.attemptResult.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    assert.equal(after.overallPct, saved.overallPct);
    assert.deepEqual([...stub.efforts].sort(), ["high", "medium"], "baholash high, tahlil medium (+ darvozada high)");

    console.log("ai-integration: OK", { verdict: saved.verdict, pct: saved.overallPct, summary: { ...summary } });
    if (process.env.KEEP) console.log("KEEP attempt:", attempt.id, "assessment:", a.id);
  } finally {
    if (!process.env.KEEP) await db.assessment.delete({ where: { id: a.id } });
    await db.question.delete({ where: { id: tmpQ.id } }).catch(() => {});
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
