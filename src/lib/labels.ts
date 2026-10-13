import type { VerdictKey } from "./scoring";

export const LEVEL_NAMES = ["", "Boshlang'ich", "Rivojlanayotgan", "Yaxshi", "Professional", "Ekspert"] as const;
export const LEVEL_COLORS: [string, string][] = [
  ["#8795A6", "#ffffff"],
  ["#C9B79A", "#14243A"],
  ["#FFB27A", "#14243A"],
  ["#F26B1D", "#1A0C02"],
  ["#D6A45B", "#14243A"],
];

export function levelName(level: number | null) {
  if (level === null) return "—";
  return LEVEL_NAMES[Math.min(5, Math.max(1, Math.round(level)))];
}

export const VERDICTS: Record<VerdictKey, { label: string; icon: string; bg: string; fg: string }> = {
  MOS: { label: "Mos", icon: "✓", bg: "var(--ok-t)", fg: "var(--ok)" },
  SHARTLI_MOS: { label: "Shartli mos", icon: "◐", bg: "var(--warn-t)", fg: "var(--warn)" },
  RIVOJLANTIRISH: { label: "Rivojlantirish kerak", icon: "▲", bg: "var(--tint)", fg: "var(--brd)" },
  MOS_EMAS: { label: "Mos emas", icon: "✕", bg: "var(--bad-t)", fg: "var(--bad)" },
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  MCQ_SINGLE: "Bitta javobli test",
  MCQ_MULTI: "Ko'p javobli test",
  SITUATIONAL: "Vaziyatli savol",
  OPEN: "Ochiq javob",
  CODE: "Kod",
  SQL: "SQL",
  PROMPT: "Prompt yozish",
  AI_REVIEW: "AI natijasini tekshirish",
  SUBMISSION: "Fayl / havola",
};

export const SUPPORTED_TYPES = ["MCQ_SINGLE", "MCQ_MULTI", "SITUATIONAL", "OPEN"] as const;
