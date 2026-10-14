// Analitika: bo'lim kesimi, xodimlar rivoji, savollar sifati va AI xarajatlari.
import { db } from "@/lib/db";

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Oxirgi n oy kalitlari (eskidan yangiga). */
function lastMonths(n: number, now = new Date()) {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)));
}

// ---------- 1. Bo'lim va lavozimlar kesimi ----------

export async function departmentAnalytics() {
  const [positions, results, scores] = await Promise.all([
    db.position.findMany({
      orderBy: { title: "asc" },
      select: { id: true, code: true, title: true, competencies: { select: { id: true, code: true, name: true, target: true, critical: true } } },
    }),
    db.attemptResult.findMany({
      select: {
        overallPct: true,
        createdAt: true,
        redFlags: true,
        criticalFail: true,
        attempt: { select: { assessment: { select: { positionId: true, mode: true } } } },
      },
    }),
    db.competencyScore.findMany({
      where: { attempt: { result: { isNot: null } } },
      select: { level: true, competencyId: true },
    }),
  ]);

  const levelsByComp = new Map<string, number[]>();
  for (const s of scores) levelsByComp.set(s.competencyId, [...(levelsByComp.get(s.competencyId) ?? []), s.level]);

  const rows = positions.map((p) => {
    const mine = results.filter((r) => r.attempt.assessment.positionId === p.id);
    const comps = p.competencies
      .map((c) => {
        const lv = levelsByComp.get(c.id) ?? [];
        const a = avg(lv);
        return { code: c.code, name: c.name, target: c.target, critical: c.critical, n: lv.length, avgLevel: a, gap: a === null ? null : a - c.target };
      })
      .filter((c) => c.n > 0);
    return {
      code: p.code,
      title: p.title,
      n: mine.length,
      candidates: mine.filter((r) => r.attempt.assessment.mode === "RECRUITING").length,
      employees: mine.filter((r) => r.attempt.assessment.mode === "EVALUATION").length,
      avgPct: avg(mine.map((r) => r.overallPct)),
      withFlags: mine.filter((r) => Array.isArray(r.redFlags) && r.redFlags.length > 0).length,
      criticalLow: mine.filter((r) => r.criticalFail).length,
      weakest: comps.filter((c) => c.gap !== null).sort((a, b) => (a.gap as number) - (b.gap as number)).slice(0, 3),
    };
  });

  const months = lastMonths(6);
  const trend = months.map((m) => {
    const inMonth = results.filter((r) => monthKey(r.createdAt) === m);
    return { month: m, n: inMonth.length, avgPct: avg(inMonth.map((r) => r.overallPct)) };
  });

  // Bo'lim bo'yicha eng zaif kompetensiya nomlari (bir xil nomlar lavozimlararo birlashtiriladi)
  const byName = new Map<string, { gaps: number[]; positions: Set<string> }>();
  for (const r of rows)
    for (const c of positions.find((p) => p.code === r.code)!.competencies) {
      const lv = levelsByComp.get(c.id) ?? [];
      if (!lv.length) continue;
      const e = byName.get(c.name) ?? { gaps: [], positions: new Set<string>() };
      e.gaps.push(...lv.map((l) => l - c.target));
      e.positions.add(r.title);
      byName.set(c.name, e);
    }
  const weakestOverall = [...byName.entries()]
    .map(([name, e]) => ({ name, gap: avg(e.gaps) as number, n: e.gaps.length, positions: [...e.positions] }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 6);

  return {
    total: results.length,
    avgPct: avg(results.map((r) => r.overallPct)),
    withFlags: results.filter((r) => Array.isArray(r.redFlags) && r.redFlags.length > 0).length,
    rows,
    trend,
    weakestOverall,
  };
}

// ---------- 2. Xodimlar rivoji ----------

export async function employeeGrowth() {
  const results = await db.attemptResult.findMany({
    where: { attempt: { assessment: { mode: "EVALUATION" } } },
    orderBy: { createdAt: "asc" },
    select: {
      attemptId: true,
      overallPct: true,
      createdAt: true,
      attempt: {
        select: {
          scores: { select: { level: true, competency: { select: { code: true, name: true, target: true } } } },
          assessment: { select: { subjectName: true, contact: true, position: { select: { title: true } } } },
        },
      },
    },
  });

  // Bir xodim — ism (+ aloqa) va lavozim bo'yicha
  const people = new Map<string, typeof results>();
  for (const r of results) {
    const a = r.attempt.assessment;
    const key = `${a.subjectName.trim().toLowerCase()}|${(a.contact ?? "").trim().toLowerCase()}|${a.position.title}`;
    people.set(key, [...(people.get(key) ?? []), r]);
  }

  return [...people.values()]
    .map((rs) => {
      const first = rs[0];
      const last = rs[rs.length - 1];
      const lvl = (r: (typeof rs)[number]) => new Map(r.attempt.scores.map((s) => [s.competency.code, s.level]));
      const f = lvl(first);
      const changes = last.attempt.scores
        .map((s) => ({
          code: s.competency.code,
          name: s.competency.name,
          target: s.competency.target,
          from: f.get(s.competency.code) ?? null,
          to: s.level,
        }))
        .filter((c) => c.from !== null && c.from !== c.to)
        .sort((a, b) => Math.abs(b.to - (b.from as number)) - Math.abs(a.to - (a.from as number)));
      return {
        name: first.attempt.assessment.subjectName,
        position: first.attempt.assessment.position.title,
        count: rs.length,
        firstPct: first.overallPct,
        lastPct: last.overallPct,
        delta: rs.length > 1 ? last.overallPct - first.overallPct : null,
        firstAt: first.createdAt,
        lastAt: last.createdAt,
        lastAttemptId: last.attemptId,
        history: rs.map((r) => r.overallPct),
        changes: changes.slice(0, 4),
        belowTarget: last.attempt.scores.filter((s) => s.level < s.competency.target).length,
      };
    })
    .sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999) || b.lastAt.getTime() - a.lastAt.getTime());
}

// ---------- 3. Savollar sifati ----------

export type QuestionStat = {
  id: string;
  stem: string;
  type: string;
  level: number;
  position: string;
  competency: string;
  n: number;
  avgScore: number | null;
  avgTimeSec: number;
  limitSec: number;
  unusedOptions: number[];
  optionCount: number;
  issues: string[];
};

export async function questionQuality(minN = 3) {
  const questions = await db.question.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      stem: true,
      type: true,
      level: true,
      timeLimitSec: true,
      payload: true,
      answerKey: true,
      competency: { select: { code: true, position: { select: { title: true } } } },
      responses: { where: { attempt: { finishedAt: { not: null } } }, select: { score: true, timeMs: true, payload: true } },
    },
  });

  const stats: QuestionStat[] = questions.map((q) => {
    const rs = q.responses;
    const scored = rs.map((r) => r.score).filter((s): s is number => typeof s === "number");
    const options = ((q.payload as { options?: unknown[] } | null)?.options ?? []).length;
    const picks = new Array(options).fill(0);
    for (const r of rs) {
      const sel = (r.payload as { selected?: number | number[] | null } | null)?.selected;
      for (const i of Array.isArray(sel) ? sel : typeof sel === "number" ? [sel] : []) if (i >= 0 && i < options) picks[i]++;
    }
    const key = (q.answerKey as { correct?: number | number[] } | null)?.correct;
    const correctSet = new Set(Array.isArray(key) ? key : typeof key === "number" ? [key] : []);
    const unusedOptions = options && rs.length >= minN ? picks.map((c, i) => (c === 0 && !correctSet.has(i) ? i : -1)).filter((i) => i >= 0) : [];
    const avgScore = avg(scored);
    const avgTimeSec = Math.round((avg(rs.map((r) => r.timeMs)) ?? 0) / 1000);
    const issues: string[] = [];
    if (rs.length >= minN && avgScore !== null) {
      if (avgScore >= 0.9) issues.push("juda oson");
      if (avgScore <= 0.2) issues.push("juda qiyin");
    }
    if (unusedOptions.length) issues.push(`${unusedOptions.length} ta variant hech tanlanmagan`);
    if (rs.length >= minN && avgTimeSec > q.timeLimitSec * 1.2) issues.push("vaqt yetmayapti");
    if (rs.length >= minN && avgTimeSec > 0 && avgTimeSec < Math.min(10, q.timeLimitSec * 0.1)) issues.push("juda tez javob berilmoqda");
    return {
      id: q.id,
      stem: q.stem,
      type: q.type,
      level: q.level,
      position: q.competency.position.title,
      competency: q.competency.code,
      n: rs.length,
      avgScore,
      avgTimeSec,
      limitSec: q.timeLimitSec,
      unusedOptions,
      optionCount: options,
      issues,
    };
  });

  const answered = stats.filter((s) => s.n > 0);
  return {
    totalActive: stats.length,
    answered: answered.length,
    enoughData: stats.filter((s) => s.n >= minN).length,
    minN,
    flagged: stats.filter((s) => s.issues.length).sort((a, b) => b.n - a.n),
    hardest: answered.filter((s) => s.n >= minN && s.avgScore !== null).sort((a, b) => (a.avgScore as number) - (b.avgScore as number)).slice(0, 8),
  };
}

// ---------- 4. AI xarajatlari ----------

/** Qayd etish boshlanishidan oldingi tahlillar uchun taxminiy narx (bitta tahlil, USD; o'lchangan o'rtacha). */
export const LEGACY_ANALYSIS_USD = 0.5;

export async function aiCosts() {
  const [usage, legacy] = await Promise.all([
    db.aiUsage.findMany({ orderBy: { at: "asc" }, select: { kind: true, costUsd: true, inputTokens: true, outputTokens: true, at: true, attemptId: true } }),
    // Qayd etilmagan (eski) tahlillar
    db.attemptResult.count({ where: { analysisAt: { not: null }, attempt: { aiUsage: { none: { kind: "analysis" } } } } }),
  ]);
  const months = lastMonths(6);
  const byMonth = months.map((m) => {
    const rows = usage.filter((u) => monthKey(u.at) === m);
    return {
      month: m,
      analysis: rows.filter((u) => u.kind === "analysis").reduce((s, u) => s + u.costUsd, 0),
      grade: rows.filter((u) => u.kind === "grade").reduce((s, u) => s + u.costUsd, 0),
      n: rows.filter((u) => u.kind === "analysis").length,
    };
  });
  const analyses = usage.filter((u) => u.kind === "analysis");
  const grades = usage.filter((u) => u.kind === "grade");
  const sum = (xs: { costUsd: number }[]) => xs.reduce((s, x) => s + x.costUsd, 0);
  const now = new Date();
  const thisMonth = usage.filter((u) => monthKey(u.at) === monthKey(now));
  return {
    totalUsd: sum(usage),
    thisMonthUsd: sum(thisMonth),
    analysisCount: analyses.length,
    gradeCount: grades.length,
    avgAnalysisUsd: analyses.length ? sum(analyses) / analyses.length : null,
    avgPerCandidateUsd: (() => {
      const ids = new Set(usage.map((u) => u.attemptId).filter(Boolean));
      return ids.size ? sum(usage) / ids.size : null;
    })(),
    tokens: { input: usage.reduce((s, u) => s + u.inputTokens, 0), output: usage.reduce((s, u) => s + u.outputTokens, 0) },
    legacyAnalyses: legacy,
    legacyUsd: legacy * LEGACY_ANALYSIS_USD,
    byMonth,
  };
}
