// Test konstruktori: lavozim testi tarkibini sozlash va har bir urinish uchun savollarni tanlash.
import { db } from "@/lib/db";
import { SUPPORTED_TYPES } from "@/lib/labels";

export type TestOrder = "competency" | "mixed";

export type CompetencyPlan = {
  id: string;
  code: string;
  name: string;
  weight: number;
  critical: boolean;
  /** Bankdagi faol savollar soni. */
  available: number;
  /** Testga olinadigan savollar soni (konstruktorda belgilangan yoki hammasi). */
  count: number;
  /** Bitta savolning o'rtacha vaqti (soniya). */
  avgSec: number;
};

export type PositionPlan = {
  positionId: string;
  configured: boolean;
  order: TestOrder;
  timeLimitMin: number | null;
  competencies: CompetencyPlan[];
  total: number;
  /** Tanlangan savollar vaqtining taxminiy yig'indisi (daqiqa). */
  estimatedMin: number;
};

type Pool = { id: string; level: number; type: string; timeLimitSec: number; competencyId: string; sortOrder: number };

function parseCounts(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 0) out[k] = n;
  }
  return out;
}

async function loadPool(positionId: string): Promise<Pool[]> {
  const qs = await db.question.findMany({
    where: { status: "ACTIVE", type: { in: [...SUPPORTED_TYPES] }, competency: { positionId } },
    select: { id: true, level: true, type: true, timeLimitSec: true, competencyId: true, competency: { select: { sortOrder: true } } },
  });
  return qs.map((q) => ({ ...q, sortOrder: q.competency.sortOrder }));
}

/** Lavozim testining joriy rejasi: konstruktor sozlamasi + bankdagi faol savollar. */
export async function getPositionPlan(positionId: string): Promise<PositionPlan> {
  const [config, comps, pool] = await Promise.all([
    db.testConfig.findUnique({ where: { positionId } }),
    db.competency.findMany({ where: { positionId }, orderBy: { sortOrder: "asc" } }),
    loadPool(positionId),
  ]);
  const counts = parseCounts(config?.perCompetency);
  const competencies = comps.map((c) => {
    const mine = pool.filter((q) => q.competencyId === c.id);
    const available = mine.length;
    const wanted = c.code in counts ? counts[c.code] : available;
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      weight: c.weight,
      critical: c.critical,
      available,
      count: Math.min(wanted, available),
      avgSec: available ? Math.round(mine.reduce((s, q) => s + q.timeLimitSec, 0) / available) : 90,
    };
  });
  const total = competencies.reduce((s, c) => s + c.count, 0);
  const estimatedMin = Math.round(competencies.reduce((s, c) => s + c.count * c.avgSec, 0) / 60);
  return {
    positionId,
    configured: !!config,
    order: config?.order === "mixed" ? "mixed" : "competency",
    timeLimitMin: config?.timeLimitMin ?? null,
    competencies,
    total,
    estimatedMin,
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Bitta kompetensiyadan n ta savol: darajalar va savol turlari navbatma-navbat olinadi,
 * shunda kichik testda ham faqat oson yoki faqat bitta turdagi savollar tushib qolmaydi.
 */
export function pickBalanced<T extends { level: number; type: string }>(items: T[], n: number, rnd: () => number = Math.random): T[] {
  if (n >= items.length) return [...items];
  const levels = [...new Set(items.map((q) => q.level))].sort((a, b) => a - b);
  const buckets = levels.map((l) => {
    const byType = new Map<string, T[]>();
    for (const q of shuffle(items.filter((x) => x.level === l), rnd)) byType.set(q.type, [...(byType.get(q.type) ?? []), q]);
    // Daraja ichida turlarni aralashtirib navbatlash
    const lanes = shuffle([...byType.values()], rnd);
    const out: T[] = [];
    while (lanes.some((x) => x.length)) for (const lane of lanes) if (lane.length) out.push(lane.shift()!);
    return out;
  });
  const picked: T[] = [];
  let i = Math.floor(rnd() * buckets.length);
  while (picked.length < n && buckets.some((b) => b.length)) {
    const b = buckets[i % buckets.length];
    if (b.length) picked.push(b.shift()!);
    i++;
  }
  return picked;
}

/** Yangi urinish uchun savollar ro'yxati va vaqt chegarasi (konstruktor sozlamasi bo'yicha). */
export async function buildQuestionSet(positionId: string, rnd: () => number = Math.random) {
  const [config, comps, pool] = await Promise.all([
    db.testConfig.findUnique({ where: { positionId } }),
    db.competency.findMany({ where: { positionId }, select: { id: true, code: true, sortOrder: true } }),
    loadPool(positionId),
  ]);
  const counts = parseCounts(config?.perCompetency);
  const chosen: Pool[] = [];
  for (const c of comps) {
    const mine = pool.filter((q) => q.competencyId === c.id);
    const n = c.code in counts ? Math.min(counts[c.code], mine.length) : mine.length;
    chosen.push(...pickBalanced(mine, n, rnd));
  }
  const ordered =
    config?.order === "mixed"
      ? shuffle(chosen, rnd)
      : chosen.sort((x, y) => x.sortOrder - y.sortOrder || x.level - y.level);
  return {
    questionIds: ordered.map((q) => q.id),
    timeLimitSec: config?.timeLimitMin ? config.timeLimitMin * 60 : null,
  };
}
