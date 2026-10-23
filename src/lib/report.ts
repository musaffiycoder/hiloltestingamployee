import "server-only";
import { db } from "@/lib/db";
import { computeAttempt } from "@/lib/attempt";
import { levelName } from "@/lib/labels";
import { PASS_RATIO, type VerdictKey } from "@/lib/scoring";
import type { StoredAnalysis } from "@/lib/ai/schemas";

type Opt = string | { text: string; points?: number; flag?: boolean };
const optText = (o: Opt) => (typeof o === "string" ? o : o.text);

export type ReportData = {
  subjectName: string;
  mode: "RECRUITING" | "EVALUATION";
  positionTitle: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMin: number | null;
  overallPct: number;
  requiredPct: number;
  weightedLevel: number | null;
  verdict: VerdictKey;
  criticalFail: boolean;
  needsReview: boolean;
  decision: string | null;
  redFlags: { t: string; q: string }[];
  competencies: {
    code: string;
    name: string;
    type: "SOFT" | "HARD";
    target: number;
    weight: number;
    critical: boolean;
    level: number | null;
    levelName: string;
    answered: number;
  }[];
  questions: {
    n: number;
    comp: string;
    level: number;
    type: string;
    stem: string;
    answer: string;
    correct: string;
    score: number | null;
    timeSec: number;
  }[];
  signals: { focusLost: number; paste: number };
  hrContext: string | null;
  analysis: StoredAnalysis | null;
  analysisModel: string | null;
  analysisAt: Date | null;
};

export async function loadReport(attemptId: string): Promise<ReportData | null> {
  const head = await db.attempt.findUnique({ where: { id: attemptId }, select: { finishedAt: true, result: { select: { id: true } } } });
  if (!head) return null;
  if (head.finishedAt && !head.result) await computeAttempt(attemptId);

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: { include: { position: { include: { competencies: { orderBy: { sortOrder: "asc" } } } } } },
      result: true,
      scores: true,
      signals: true,
      responses: { include: { question: { include: { competency: true } } } },
    },
  });
  if (!attempt || !attempt.result) return null;
  const { assessment, result } = attempt;

  const levelBy = new Map(attempt.scores.map((s) => [s.competencyId, s.level]));
  const asked = new Set(attempt.responses.map((r) => r.question.competencyId));
  const comps = assessment.position.competencies.filter((c) => asked.has(c.id));
  const requiredPct = Math.round(PASS_RATIO * 100);
  const scored = comps.filter((c) => levelBy.get(c.id) != null);
  const sw = scored.reduce((s, c) => s + c.weight, 0);
  const weightedLevel = sw ? scored.reduce((s, c) => s + (levelBy.get(c.id) as number) * c.weight, 0) / sw : null;

  const ordered = attempt.responses
    .slice()
    .sort((a, b) => a.question.competency.sortOrder - b.question.competency.sortOrder || a.question.level - b.question.level);

  const questions = ordered.map((r, i) => {
    const q = r.question;
    const p = (r.payload ?? {}) as { selected?: number | number[] | null; text?: string };
    const opts = ((q.payload as { options?: Opt[] })?.options ?? []) as Opt[];
    const key = (q.answerKey as { correct?: number | number[] } | null)?.correct;
    let answer = "(javob yo'q)";
    let correct = "—";
    if (q.type === "OPEN") {
      answer = p.text?.trim() || "(javob yo'q)";
      const pts = (q.rubric as { points?: string[] } | null)?.points;
      correct = pts?.length ? pts.join("; ") : "Rubrika belgilanmagan";
    } else if (Array.isArray(p.selected) && p.selected.length) {
      answer = p.selected.map((k) => (opts[k] ? optText(opts[k]) : "")).filter(Boolean).join(" · ");
    } else if (typeof p.selected === "number" && opts[p.selected]) {
      answer = optText(opts[p.selected]);
    }
    if (q.type === "SITUATIONAL") {
      const best = opts.map((o, k) => ({ o, k })).sort((a, b) => ((b.o as { points?: number }).points ?? 0) - ((a.o as { points?: number }).points ?? 0))[0];
      correct = best ? optText(best.o) : "—";
    } else if (q.type !== "OPEN") {
      if (Array.isArray(key)) correct = key.map((k) => optText(opts[k])).join(" · ");
      else if (typeof key === "number") correct = optText(opts[key]);
    }
    return {
      n: i + 1,
      comp: q.competency.code,
      level: q.level,
      type: q.type,
      stem: q.stem,
      answer,
      correct,
      score: r.score,
      timeSec: Math.round(r.timeMs / 1000),
    };
  });

  const durationMin = attempt.finishedAt
    ? Math.max(1, Math.round((attempt.finishedAt.getTime() - attempt.startedAt.getTime()) / 60000))
    : null;

  return {
    subjectName: assessment.subjectName,
    mode: assessment.mode,
    positionTitle: assessment.position.title,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    durationMin,
    overallPct: result.overallPct,
    requiredPct,
    weightedLevel,
    verdict: result.verdict as VerdictKey,
    criticalFail: result.criticalFail,
    needsReview: result.needsReview,
    decision: result.decision,
    redFlags: (Array.isArray(result.redFlags) ? result.redFlags : []) as { t: string; q: string }[],
    competencies: comps.map((c) => ({
      code: c.code,
      name: c.name,
      type: c.type as "SOFT" | "HARD",
      target: c.target,
      weight: c.weight,
      critical: c.critical,
      level: levelBy.get(c.id) ?? null,
      levelName: levelName(levelBy.get(c.id) ?? null),
      answered: attempt.responses.filter((r) => r.question.competencyId === c.id).length,
    })),
    questions,
    signals: {
      focusLost: attempt.signals.filter((s) => s.type === "focus_lost").length,
      paste: attempt.signals.filter((s) => s.type === "paste").length,
    },
    hrContext: result.hrContext,
    analysis: (result.analysis ?? null) as StoredAnalysis | null,
    analysisModel: result.analysisModel,
    analysisAt: result.analysisAt,
  };
}
