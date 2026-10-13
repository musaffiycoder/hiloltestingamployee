export type SeedQuestion = {
  comp: string;
  level: number;
  type: "MCQ_SINGLE" | "MCQ_MULTI" | "SITUATIONAL" | "OPEN";
  stem: string;
  options?: string[];
  situational?: { text: string; points: number; flag?: boolean }[];
  key?: number | number[];
  explanation?: string;
  timeLimitSec?: number;
  rubric?: string[];
};
