// Ikki mustaqil baholovchi natijasini birlashtirish (sof funksiya, testlanadi).
import type { GradeResult } from "./schemas";

export const DISAGREEMENT_GAP = 0.25; // shundan katta farq — kelishmovchilik
export const LOW_CONFIDENCE = 0.6;

const q = (x: number) => Math.round(x * 4) / 4;

export type Combined = {
  score: number;
  confidence: number;
  disagreement: boolean;
  injectionAttempt: boolean;
  rationale: string;
};

export function combineGrades(a: GradeResult, b: GradeResult): Combined {
  const gap = Math.abs(a.score - b.score);
  const disagreement = gap > DISAGREEMENT_GAP + 1e-9;
  const mean = q((a.score + b.score) / 2);
  const baseConf = Math.min(a.confidence, b.confidence);
  // Kelishmasa, ishonch avtomatik pasaytiriladi — natija «ko'rib chiqish kerak»ga tushadi
  const confidence = disagreement ? Math.min(baseConf, 0.45) : baseConf;
  const rationale = disagreement
    ? `Baholovchilar kelishmadi (A: ${Math.round(a.score * 100)}%, B: ${Math.round(b.score * 100)}%) — odam ko'rishi kerak. A: ${a.rationale} B: ${b.rationale}`
    : `${a.rationale}${b.rationale !== a.rationale ? ` (B: ${b.rationale})` : ""}`;
  return {
    score: disagreement ? mean : q(mean),
    confidence,
    disagreement,
    injectionAttempt: a.injectionAttempt || b.injectionAttempt,
    rationale: rationale.slice(0, 1500),
  };
}
