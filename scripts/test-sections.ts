import assert from "node:assert/strict";
import { sectionOf, standardTimeSec, timingOf } from "../src/lib/sections";
import { sectionEstimate } from "../src/lib/test-config-math";

const t0 = new Date("2026-10-28T10:00:00Z");
const at = (min: number) => t0.getTime() + min * 60_000;
const base = { startedAt: t0, timeLimitSec: null, closedTimeSec: 60 * 60, openTimeSec: 40 * 60, openStartedAt: null };

assert.equal(sectionOf("OPEN"), "open");
assert.equal(sectionOf("MCQ_SINGLE"), "closed");
assert.equal(sectionOf("SITUATIONAL"), "closed");

// standart vaqt: test savoli 3,5 daqiqa, yozma 8 daqiqa
assert.equal(standardTimeSec("MCQ_SINGLE"), 210);
assert.equal(standardTimeSec("SITUATIONAL"), 210);
assert.equal(standardTimeSec("OPEN"), 480);

// test bo'limi davom etmoqda
let t = timingOf(base, 0, at(10));
assert.ok(t.mode === "sections" && t.phase === "closed" && t.left === 50 * 60);
// test bo'limi vaqti tugadi — yozma bo'lim o'zi boshlanadi (sahifa yopiq bo'lsa ham vaqt ketadi)
t = timingOf(base, 0, at(70));
assert.ok(t.mode === "sections" && t.phase === "open" && t.left === 30 * 60);
// nomzod 20-daqiqada yozma bo'limga o'tdi — yozma vaqt o'shandan hisoblanadi
t = timingOf({ ...base, openStartedAt: new Date(at(20)) }, 0, at(30));
assert.ok(t.mode === "sections" && t.phase === "open" && t.left === 30 * 60);
// kech yozilgan openStartedAt test bo'limi tugagan paytdan oshmaydi
t = timingOf({ ...base, openStartedAt: new Date(at(90)) }, 0, at(95));
assert.ok(t.mode === "sections" && t.phase === "open" && t.left === 5 * 60);
// yozma vaqt ham tugadi
t = timingOf(base, 0, at(200));
assert.ok(t.mode === "sections" && t.left === 0);
// faqat yozma savollar (test bo'limi 0)
t = timingOf({ ...base, closedTimeSec: 0 }, 0, at(5));
assert.ok(t.mode === "sections" && t.phase === "open" && t.left === 35 * 60);
// eski urinish — bitta umumiy vaqt
t = timingOf({ ...base, closedTimeSec: null, openTimeSec: null, timeLimitSec: 3600 }, 0, at(15));
assert.ok(t.mode === "single" && t.left === 45 * 60);
t = timingOf({ ...base, closedTimeSec: null, openTimeSec: null }, 1800, at(10));
assert.ok(t.mode === "single" && t.left === 20 * 60);

// bo'limlar bo'yicha taxmin: kompetensiya ichidagi ulush
const est = sectionEstimate(
  [{ available: 10, bySection: { closed: { available: 8, avgSec: 120 }, open: { available: 2, avgSec: 600 } } }],
  () => 5,
);
assert.deepEqual(est, { closed: { count: 4, estimatedMin: 8 }, open: { count: 1, estimatedMin: 10 } });

console.log("sections: OK");
