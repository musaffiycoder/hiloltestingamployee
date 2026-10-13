// Savol sifatini tekshirish: "to'g'ri javob osongina topiladigan" ishoralarni aniqlaydi.
// Sof funksiyalar (server va client'da ishlaydi).

export type Warning = { code: string; severity: "warn" | "info"; message: string };

export type QuestionLike = {
  type: "MCQ_SINGLE" | "MCQ_MULTI" | "SITUATIONAL" | "OPEN";
  stem: string;
  options: { text: string; correct?: boolean; points?: number }[];
};

const ABSOLUTES = [
  "hech qachon", "hech narsa", "hech kim", "doim", "har doim", "faqat", "mutlaqo", "barcha holatda",
  "никогда", "всегда", "только", "always", "never", "only", "none of",
];
const ALL_OF_ABOVE = ["yuqoridagilarning hammasi", "hammasi to'g'ri", "barchasi to'g'ri", "hech biri", "all of the above", "none of the above"];

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5);

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export function analyzeQuestion(q: QuestionLike): Warning[] {
  const out: Warning[] = [];
  const stemLen = q.stem.trim().length;
  if (stemLen < 25) out.push({ code: "short_stem", severity: "info", message: "Savol matni juda qisqa (25 belgidan kam)." });

  if (q.type === "OPEN") return out;

  const opts = q.options;
  if (opts.length < 4) {
    out.push({ code: "few_options", severity: "info", message: "4 tadan kam variant: taxmin qilish ehtimoli yuqori." });
  }

  // Qaysi variant "to'g'ri" (eng yaxshi) hisoblanadi
  const best: number[] =
    q.type === "SITUATIONAL"
      ? (() => {
          const max = Math.max(...opts.map((o) => o.points ?? 0));
          return opts.flatMap((o, i) => ((o.points ?? 0) === max && max >= 4 ? [i] : []));
        })()
      : opts.flatMap((o, i) => (o.correct ? [i] : []));
  if (best.length === 0 || best.length === opts.length) return out;

  const lens = opts.map((o) => o.text.trim().length);
  const rest = lens.filter((_, i) => !best.includes(i));
  const bestLen = mean(best.map((i) => lens[i]));

  // 1) Uzunlik ishorasi: to'g'ri javob boshqalardan sezilarli uzun
  const maxRest = Math.max(...rest);
  if (bestLen >= 1.4 * mean(rest) && bestLen > maxRest) {
    out.push({
      code: "length_tell",
      severity: "warn",
      message: `To'g'ri javob eng uzun (${Math.round(bestLen)} belgi, boshqalar o'rtacha ${Math.round(mean(rest))}). Variantlar uzunligini tenglashtiring.`,
    });
  }
  // Teskari ishora: to'g'ri javob eng qisqa va boshqalar juda uzun (kamroq uchraydi)
  const minRest = Math.min(...rest);
  if (bestLen <= 0.6 * mean(rest) && bestLen < minRest) {
    out.push({
      code: "short_tell",
      severity: "info",
      message: "To'g'ri javob boshqalardan ancha qisqa — bu ham ishora bo'lishi mumkin.",
    });
  }

  // 2) Savol matni bilan so'z takrori: to'g'ri variant savol so'zlarini aks ettiradi
  const stemWords = new Set(words(q.stem));
  if (stemWords.size > 0) {
    const overlap = opts.map((o) => words(o.text).filter((w) => stemWords.has(w)).length);
    const bestOv = Math.max(...best.map((i) => overlap[i]));
    const restOv = Math.max(0, ...overlap.filter((_, i) => !best.includes(i)));
    if (bestOv >= 2 && bestOv > restOv + 1) {
      out.push({
        code: "stem_echo",
        severity: "warn",
        message: "To'g'ri javob savol matnidagi so'zlarni takrorlaydi; noto'g'ri variantlar takrorlamaydi.",
      });
    }
  }

  // 3) Mutlaq so'zlar faqat noto'g'ri variantlarda
  const hasAbs = (t: string) => ABSOLUTES.some((a) => t.toLowerCase().includes(a));
  const absInRest = opts.filter((o, i) => !best.includes(i) && hasAbs(o.text)).length;
  const absInBest = best.filter((i) => hasAbs(opts[i].text)).length;
  if (absInRest >= 1 && absInBest === 0 && rest.length >= 2 && absInRest >= Math.ceil(rest.length / 2)) {
    out.push({
      code: "absolute_distractors",
      severity: "warn",
      message: "Noto'g'ri variantlarda «doim / hech qachon / faqat» kabi so'zlar bor — bu to'g'ri javobni ochib qo'yadi.",
    });
  }

  // 4) "Hammasi to'g'ri" turidagi variantlar
  if (opts.some((o) => ALL_OF_ABOVE.some((p) => o.text.toLowerCase().includes(p)))) {
    out.push({ code: "all_of_above", severity: "info", message: "«Hammasi to'g'ri / hech biri» turidagi variant ishlatilgan." });
  }

  // 5) Takrorlangan variantlar
  const norm = opts.map((o) => o.text.trim().toLowerCase());
  if (new Set(norm).size !== norm.length) out.push({ code: "duplicate", severity: "warn", message: "Variantlar ichida bir xillari bor." });

  // 6) Situatsion savol: eng yaxshi variant "to'liq javob" ko'rinishida, boshqalar bir gap
  if (q.type === "SITUATIONAL") {
    const sentences = (t: string) => t.split(/[.!?;]+/).filter((x) => x.trim().length > 3).length;
    const bestS = mean(best.map((i) => sentences(opts[i].text)));
    const restS = mean(opts.flatMap((o, i) => (best.includes(i) ? [] : [sentences(o.text)])));
    if (bestS >= restS + 1 && bestS >= 2) {
      out.push({
        code: "detail_tell",
        severity: "info",
        message: "Eng yaxshi variant batafsilroq (ko'proq gap) — ko'p holatda bu uni ochib beradi.",
      });
    }
  }

  return out;
}

/** To'plam bo'yicha tekshiruv: to'g'ri javob joylashuvi bir tomonlama emasmi. */
export function analyzeBatch(qs: QuestionLike[]): Warning[] {
  const out: Warning[] = [];
  const singles = qs.filter((q) => q.type === "MCQ_SINGLE" && q.options.length > 0);
  if (singles.length >= 6) {
    const counts = new Map<number, number>();
    for (const q of singles) {
      const i = q.options.findIndex((o) => o.correct);
      if (i >= 0) counts.set(i, (counts.get(i) ?? 0) + 1);
    }
    for (const [idx, n] of counts) {
      if (n / singles.length > 0.45) {
        out.push({
          code: "position_bias",
          severity: "warn",
          message: `To'g'ri javobning ${Math.round((n / singles.length) * 100)}% i ${String.fromCharCode(65 + idx)} variantda. Kalit joylashuvi bir tekis bo'lishi kerak (testda variantlar baribir aralashtiriladi, lekin bank sifatiga ta'sir qiladi).`,
        });
      }
    }
  }
  return out;
}
