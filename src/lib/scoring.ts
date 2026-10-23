// Baholash mexanizmi: kompetensiya darajasi, umumiy ball va xulosa.
// Qoidalar: kartalar/00-umumiy-qoidalar.md §4 va platforma-spetsifikatsiyasi.md §4.

export type VerdictKey = "MOS" | "SHARTLI_MOS" | "RIVOJLANTIRISH" | "MOS_EMAS";

export type CompetencyDef = {
  id: string;
  code: string;
  name: string;
  target: number;
  weight: number;
  critical: boolean;
};

export type ScoredItem = {
  level: number; // savol darajasi 1–5
  score: number; // 0..1
};

export type CompetencyResult = {
  id: string;
  code: string;
  name: string;
  target: number;
  weight: number;
  critical: boolean;
  level: number | null; // null = baholanmagan (qo'lda ko'rib chiqish kerak)
  gap: number | null;
  answered: number;
  ratioByLevel: Record<number, number>;
};

export type Evaluation = {
  competencies: CompetencyResult[];
  overallPct: number;
  verdict: VerdictKey;
  criticalFail: boolean;
  unscored: string[];
  reasons: string[];
};

export const PASS_RATIO = 0.7;
export const HALF_STEP_RATIO = 0.5;
/** Umumiy ball shundan past bo'lsa — mos emas (to'g'ri javoblar ulushi, %). */
export const MIN_OVERALL_PCT = 50;

/**
 * Kompetensiya darajasi = ketma-ket (pastdan yuqoriga) ≥70% bo'lgan eng yuqori daraja.
 * Keyingi daraja 50–70% oralig'ida bo'lsa, +0,5.
 * Savol berilgan darajalar bo'yicha yuriladi; birinchi muvaffaqiyatsizlikda to'xtaydi.
 */
export function levelFromItems(items: ScoredItem[]): {
  level: number | null;
  ratioByLevel: Record<number, number>;
} {
  if (items.length === 0) return { level: null, ratioByLevel: {} };

  const byLevel = new Map<number, number[]>();
  for (const it of items) {
    const arr = byLevel.get(it.level) ?? [];
    arr.push(it.score);
    byLevel.set(it.level, arr);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const ratioByLevel: Record<number, number> = {};
  for (const l of levels) {
    const arr = byLevel.get(l)!;
    ratioByLevel[l] = arr.reduce((s, x) => s + x, 0) / arr.length;
  }

  // Yo'riqnomada faqat 3 (Yaxshi) va 4 (Professional) talab qilinadi: eng past sinalgan daraja yiqilsa,
  // natija shu darajadan bir pog'ona past (3 yiqilsa — 2, ≥50% bo'lsa 2.5). Pastroq darajalar sinalmaydi.
  let reached = Math.max(1, levels[0] - 1);
  let bonus = 0;
  for (const l of levels) {
    const r = ratioByLevel[l];
    if (r >= PASS_RATIO) {
      reached = l;
      bonus = 0;
    } else {
      if (r >= HALF_STEP_RATIO && l > reached) bonus = 0.5;
      break;
    }
  }
  return { level: Math.min(5, reached + bonus), ratioByLevel };
}

export function evaluate(
  defs: CompetencyDef[],
  itemsByCompetency: Record<string, ScoredItem[]>,
  opts: { redFlags?: number } = {},
): Evaluation {
  const reasons: string[] = [];
  const competencies: CompetencyResult[] = defs.map((d) => {
    const items = itemsByCompetency[d.id] ?? [];
    const { level, ratioByLevel } = levelFromItems(items);
    return {
      ...d,
      level,
      gap: level === null ? null : level - d.target,
      answered: items.length,
      ratioByLevel,
    };
  });

  const scored = competencies.filter((c) => c.level !== null);
  const unscored = competencies.filter((c) => c.level === null).map((c) => c.code);
  // Umumiy ball = kompetensiyalar bo'yicha to'g'ri javob ulushining vaznli o'rtachasi.
  // Daraja/5 ishlatilmaydi: bank faqat 3–4 darajani sinaydi, shuning uchun u 40–80% oralig'iga siqilib qolardi.
  const wSum = scored.reduce((s, c) => s + c.weight, 0);
  const ratioOf = (id: string) => {
    const arr = itemsByCompetency[id] ?? [];
    return arr.reduce((s, x) => s + x.score, 0) / arr.length;
  };
  const overallPct = wSum === 0 ? 0 : (scored.reduce((s, c) => s + ratioOf(c.id) * c.weight, 0) / wSum) * 100;

  const critical = scored.filter((c) => c.critical);
  const criticalFloor = critical.some((c) => (c.level as number) <= 2);
  const criticalLow = critical.some((c) => (c.level as number) < 3);
  const criticalBelowTarget = critical.some((c) => (c.gap as number) < 0);
  const below1 = scored.filter((c) => (c.gap as number) <= -1).length;
  const below2 = scored.some((c) => !c.critical && (c.gap as number) <= -2);

  let verdict: VerdictKey;
  if ((opts.redFlags ?? 0) > 0) {
    verdict = "MOS_EMAS";
    reasons.push("Qizil bayroq aniqlangan");
  } else if (criticalFloor) {
    verdict = "MOS_EMAS";
    reasons.push("Kritik kompetensiya 2 va undan past");
  } else if (scored.length > 0 && overallPct < MIN_OVERALL_PCT) {
    verdict = "MOS_EMAS";
    reasons.push("Umumiy ball 50% dan past");
  } else if (criticalLow) {
    verdict = "RIVOJLANTIRISH";
    reasons.push("Kritik kompetensiya 3 dan past");
  } else if (below1 >= 3 || below2) {
    verdict = "RIVOJLANTIRISH";
    reasons.push(below2 ? "Kompetensiya talabdan 2+ daraja past" : "3 ta va undan ko'p kompetensiya talabdan past");
  } else if (criticalBelowTarget) {
    verdict = "SHARTLI_MOS";
    reasons.push("Kritik kompetensiya talabdan 1 daraja past");
  } else {
    verdict = "MOS";
  }

  return {
    competencies,
    overallPct: Math.round(overallPct * 10) / 10,
    verdict,
    criticalFail: criticalFloor,
    unscored,
    reasons,
  };
}

// ---------- Savol javobini baholash (avtomatik turlar) ----------

export type McqPayload = { options: string[] };
export type SituationalPayload = { options: { text: string; points: number }[] };

export function scoreMcqSingle(selected: number | null, correct: number): number {
  return selected === correct ? 1 : 0;
}

export function scoreMcqMulti(selected: number[], correct: number[]): number {
  if (correct.length === 0) return 0;
  const c = new Set(correct);
  const hit = selected.filter((s) => c.has(s)).length;
  const wrong = selected.filter((s) => !c.has(s)).length;
  return Math.max(0, Math.min(1, (hit - wrong) / correct.length));
}

/** Vaziyatli savol: har bir variantga 1–5 ball biriktirilgan; 1→0, 5→1. */
export function scoreSituational(selected: number | null, options: { points: number }[]): number {
  if (selected === null || !options[selected]) return 0;
  return (options[selected].points - 1) / 4;
}
