import { z } from "zod";

/** Import formati (Gemini yoki qo'lda yozilgan JSON) — DB shakliga o'tkazish bilan. */
const base = {
  position: z.string().min(1, "position (lavozim kodi) majburiy"),
  competency: z.string().min(1, "competency (kompetensiya kodi) majburiy"),
  level: z.number().int().min(1).max(5),
  stem: z.string().trim().min(10, "stem kamida 10 belgi").max(1500),
  explanation: z.string().trim().max(1000).optional(),
  timeLimitSec: z.number().int().min(15).max(900).optional(),
  status: z.enum(["ACTIVE", "DRAFT"]).optional(),
};

const mcqSingle = z
  .object({
    ...base,
    type: z.literal("MCQ_SINGLE"),
    options: z.array(z.string().trim().min(1).max(500)).min(3, "kamida 3 ta variant").max(6),
    correct: z.number().int().min(0),
  })
  .refine((q) => q.correct < q.options.length, { message: "correct indeksi variantlar sonidan tashqarida", path: ["correct"] });

const mcqMulti = z
  .object({
    ...base,
    type: z.literal("MCQ_MULTI"),
    options: z.array(z.string().trim().min(1).max(500)).min(4, "ko'p javobli savolda kamida 4 ta variant").max(8),
    correct: z.array(z.number().int().min(0)).min(2, "kamida 2 ta to'g'ri javob"),
  })
  .refine((q) => q.correct.every((i) => i < q.options.length) && new Set(q.correct).size === q.correct.length, {
    message: "correct indekslari noto'g'ri yoki takrorlangan",
    path: ["correct"],
  })
  .refine((q) => q.correct.length < q.options.length, { message: "hamma variant to'g'ri bo'lishi mumkin emas", path: ["correct"] });

const situational = z
  .object({
    ...base,
    type: z.literal("SITUATIONAL"),
    options: z
      .array(
        z.object({
          text: z.string().trim().min(1).max(500),
          points: z.number().int().min(1).max(5),
          flag: z.boolean().optional(),
        }),
      )
      .min(3, "kamida 3 ta variant")
      .max(6),
  })
  .refine((q) => q.options.some((o) => o.points === 5), { message: "kamida bitta variant 5 ball bo'lishi kerak", path: ["options"] })
  .refine((q) => q.options.some((o) => o.points <= 2), { message: "kamida bitta variant 2 ball yoki past bo'lishi kerak", path: ["options"] });

const open = z.object({
  ...base,
  type: z.literal("OPEN"),
  rubric: z.array(z.string().trim().min(3).max(300)).min(2, "rubrikada kamida 2 band").max(10),
});

export type ImportQuestion = z.infer<typeof mcqSingle> | z.infer<typeof mcqMulti> | z.infer<typeof situational> | z.infer<typeof open>;

export function validateQuestion(raw: unknown): { ok: true; q: ImportQuestion } | { ok: false; errors: string[] } {
  const type = (raw as { type?: string } | null)?.type;
  const schema =
    type === "MCQ_SINGLE" ? mcqSingle : type === "MCQ_MULTI" ? mcqMulti : type === "SITUATIONAL" ? situational : type === "OPEN" ? open : null;
  if (!schema) return { ok: false, errors: ["type MCQ_SINGLE, MCQ_MULTI, SITUATIONAL yoki OPEN bo'lishi kerak"] };
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, q: r.data as ImportQuestion };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "savol"}: ${i.message}`) };
}

/** Import JSON'ni massivga aylantiradi: [..] yoki { "questions": [..] }. */
export function parseImportJson(text: string): { ok: true; items: unknown[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    // Gemini ko'pincha ```json ... ``` bilan o'rab beradi
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    data = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `JSON o'qib bo'lmadi: ${(e as Error).message}` };
  }
  const items = Array.isArray(data) ? data : (data as { questions?: unknown })?.questions;
  if (!Array.isArray(items)) return { ok: false, error: "JSON massiv yoki { \"questions\": [...] } bo'lishi kerak" };
  if (items.length === 0) return { ok: false, error: "Savollar ro'yxati bo'sh" };
  if (items.length > 200) return { ok: false, error: "Bir martada 200 tadan ko'p savol import qilib bo'lmaydi" };
  return { ok: true, items };
}

/** DB yozuvi uchun maydonlar. */
export function toDbShape(q: ImportQuestion) {
  if (q.type === "MCQ_SINGLE") return { payload: { options: q.options }, answerKey: { correct: q.correct }, rubric: undefined };
  if (q.type === "MCQ_MULTI") return { payload: { options: q.options }, answerKey: { correct: q.correct }, rubric: undefined };
  if (q.type === "SITUATIONAL") return { payload: { options: q.options }, answerKey: undefined, rubric: undefined };
  return { payload: {}, answerKey: undefined, rubric: { points: q.rubric } };
}

/** Savolni sifat tahlili uchun umumiy shaklga o'tkazish. */
export function toQualityShape(q: ImportQuestion) {
  if (q.type === "MCQ_SINGLE") return { type: q.type, stem: q.stem, options: q.options.map((t, i) => ({ text: t, correct: i === q.correct })) };
  if (q.type === "MCQ_MULTI") return { type: q.type, stem: q.stem, options: q.options.map((t, i) => ({ text: t, correct: q.correct.includes(i) })) };
  if (q.type === "SITUATIONAL") return { type: q.type, stem: q.stem, options: q.options.map((o) => ({ text: o.text, points: o.points })) };
  return { type: q.type, stem: q.stem, options: [] };
}
