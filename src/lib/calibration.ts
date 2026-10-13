// Kalibrlash: AI bahosi odam bahosi bilan qanchalik mos kelishini o'lchaydi (sof funksiya).

export type Pair = { ai: number; human: number };

export type CalibrationStats = {
  n: number;
  exact: number; // ulush: AI == odam
  withinOne: number; // ulush: |farq| <= 0.25 (bir pog'ona)
  mae: number; // o'rtacha mutlaq farq (0..1)
  bias: number; // o'rtacha (AI − odam): musbat — AI saxiyroq
  ready: boolean;
  verdict: string;
};

export const MIN_SAMPLES = 20;
export const WITHIN_ONE_TARGET = 0.85;
export const MAE_TARGET = 0.15;

export function calibrationStats(pairs: Pair[]): CalibrationStats {
  const n = pairs.length;
  if (n === 0) return { n: 0, exact: 0, withinOne: 0, mae: 0, bias: 0, ready: false, verdict: "Ma'lumot yo'q" };
  const diffs = pairs.map((p) => p.ai - p.human);
  const exact = diffs.filter((d) => Math.abs(d) < 1e-9).length / n;
  const withinOne = diffs.filter((d) => Math.abs(d) <= 0.25 + 1e-9).length / n;
  const mae = diffs.reduce((s, d) => s + Math.abs(d), 0) / n;
  const bias = diffs.reduce((s, d) => s + d, 0) / n;
  const enough = n >= MIN_SAMPLES;
  const good = withinOne >= WITHIN_ONE_TARGET && mae <= MAE_TARGET;
  const ready = enough && good && Math.abs(bias) <= 0.1;
  let verdict: string;
  if (!enough) verdict = `Namuna yetarli emas: kamida ${MIN_SAMPLES} ta kerak (hozir ${n})`;
  else if (ready) verdict = "AI ballari odam bahosiga yetarlicha mos — AI'ga tayanish mumkin, past ishonchli javoblar baribir odamga boradi";
  else if (Math.abs(bias) > 0.1) verdict = `AI tizimli ravishda ${bias > 0 ? "saxiyroq" : "qattiqroq"} baholayapti — rubrikani aniqlashtiring`;
  else verdict = "Kelishuv yetarli emas — rubrikalarni tuzating yoki baholashni odamda qoldiring";
  return { n, exact, withinOne, mae, bias, ready, verdict };
}
