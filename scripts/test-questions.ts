import assert from "node:assert/strict";
import { analyzeBatch, analyzeQuestion } from "../src/lib/question-quality";
import { parseImportJson, toDbShape, validateQuestion } from "../src/lib/question-schema";

const codes = (q: Parameters<typeof analyzeQuestion>[0]) => analyzeQuestion(q).map((w) => w.code);

// 1) To'g'ri javob eng uzun -> length_tell
assert.ok(
  codes({
    type: "MCQ_SINGLE",
    stem: "Parol bazada qanday saqlanishi kerak?",
    options: [
      { text: "Ochiq matn" },
      { text: "Base64" },
      { text: "bcrypt kabi sekin va tuzli xesh algoritmi bilan, har bir foydalanuvchi uchun alohida tuz bilan", correct: true },
      { text: "MD5" },
    ],
  }).includes("length_tell"),
);

// 2) Teng uzunlikdagi variantlar -> ogohlantirish yo'q
assert.deepEqual(
  codes({
    type: "MCQ_SINGLE",
    stem: "Resurs yaratilganda qaysi status-kod qaytariladi?",
    options: [{ text: "200 OK" }, { text: "201 Created", correct: true }, { text: "204 No Content" }, { text: "302 Found" }],
  }),
  [],
);

// 3) Mutlaq so'zlar faqat noto'g'ri variantlarda
assert.ok(
  codes({
    type: "MCQ_SINGLE",
    stem: "Keshni qachon bekor qilish kerak?",
    options: [
      { text: "Hech qachon bekor qilinmaydi" },
      { text: "Ma'lumot o'zgarganda" , correct: true },
      { text: "Doim har so'rovda" },
      { text: "Faqat serverni o'chirganda" },
    ],
  }).includes("absolute_distractors"),
);

// 4) Savol so'zlarini takrorlash
assert.ok(
  codes({
    type: "MCQ_SINGLE",
    stem: "Idempotent webhook ishlovchisini loyihalashda qaysi yondashuv to'g'ri?",
    options: [
      { text: "Har safar yangi yozuv" },
      { text: "Idempotent webhook ishlovchisi hodisa identifikatorini saqlaydi", correct: true },
      { text: "Javobni kechiktirish" },
      { text: "Timeoutni oshirish" },
    ],
  }).includes("stem_echo"),
);

// 5) Batch: joylashuv noto'g'ri taqsimot
const biased = Array.from({ length: 8 }, () => ({
  type: "MCQ_SINGLE" as const,
  stem: "x".repeat(30),
  options: [{ text: "a" }, { text: "b", correct: true }, { text: "c" }, { text: "d" }],
}));
assert.ok(analyzeBatch(biased).some((w) => w.code === "position_bias"));

// Import: validatsiya
const good = { position: "backend", competency: "H2", level: 3, type: "MCQ_SINGLE", stem: "Qaysi status-kod yaratilganini bildiradi?", options: ["200", "201", "204"], correct: 1 };
assert.equal(validateQuestion(good).ok, true);
assert.equal(validateQuestion({ ...good, correct: 5 }).ok, false);
assert.equal(validateQuestion({ ...good, options: ["a", "b"] }).ok, false);
assert.equal(validateQuestion({ ...good, type: "NOMA'LUM" }).ok, false);
assert.equal(validateQuestion({ ...good, type: "MCQ_MULTI", options: ["a", "b", "c", "d"], correct: [0, 1, 2, 3] }).ok, false);
assert.equal(validateQuestion({ ...good, type: "OPEN", rubric: ["bitta"] }).ok, false);
const sit = { ...good, type: "SITUATIONAL", options: [{ text: "x", points: 5 }, { text: "y", points: 1, flag: true }, { text: "z", points: 3 }] };
assert.equal(validateQuestion(sit).ok, true);
assert.equal(validateQuestion({ ...sit, options: [{ text: "x", points: 4 }, { text: "y", points: 3 }, { text: "z", points: 3 }] }).ok, false);

// JSON o'rovchi va massiv/obyekt formatlari
assert.equal(parseImportJson("```json\n[" + JSON.stringify(good) + "]\n```").ok, true);
assert.equal(parseImportJson(JSON.stringify({ questions: [good] })).ok, true);
assert.equal(parseImportJson("{}").ok, false);
assert.equal(parseImportJson("[").ok, false);

// DB shakli
const v = validateQuestion(good);
assert.ok(v.ok);
if (v.ok) assert.deepEqual(toDbShape(v.q).answerKey, { correct: 1 });

console.log("questions: OK");
