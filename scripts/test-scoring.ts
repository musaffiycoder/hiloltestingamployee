import assert from "node:assert/strict";
import { evaluate, levelFromItems, scoreMcqMulti, scoreSituational } from "../src/lib/scoring";

// levelFromItems
assert.equal(levelFromItems([]).level, null);
assert.equal(levelFromItems([{ level: 1, score: 1 }, { level: 2, score: 1 }, { level: 3, score: 1 }, { level: 4, score: 0 }]).level, 3);
// 50–70% keyingi darajada +0.5
assert.equal(levelFromItems([{ level: 1, score: 1 }, { level: 2, score: 1 }, { level: 3, score: 0.6 }]).level, 2.5);
// birinchi daraja yiqilsa ham minimum 1
assert.equal(levelFromItems([{ level: 1, score: 0 }, { level: 2, score: 1 }]).level, 1);
// muvaffaqiyatsizlikdan keyingi yuqori daraja hisobga olinmaydi
assert.equal(levelFromItems([{ level: 1, score: 1 }, { level: 2, score: 0 }, { level: 3, score: 1 }]).level, 1);

// scoring helpers
assert.equal(scoreMcqMulti([0, 1], [0, 1]), 1);
assert.equal(scoreMcqMulti([0, 2], [0, 1]), 0);
assert.equal(scoreMcqMulti([0], [0, 1]), 0.5);
assert.equal(scoreSituational(0, [{ points: 5 }, { points: 1 }]), 1);
assert.equal(scoreSituational(1, [{ points: 5 }, { points: 1 }]), 0);

const defs = [
  { id: "a", code: "S1", name: "S1", target: 3, weight: 20, critical: false },
  { id: "b", code: "H1", name: "H1", target: 4, weight: 40, critical: true },
  { id: "c", code: "H2", name: "H2", target: 4, weight: 40, critical: true },
];
const pass = (l: number) => Array.from({ length: l }, (_, i) => ({ level: i + 1, score: 1 }));

// hammasi talabda -> MOS
let r = evaluate(defs, { a: pass(3), b: pass(4), c: pass(4) });
assert.equal(r.verdict, "MOS");
assert.equal(Math.round(r.overallPct), 76);

// kritik 3 (talab 4) -> SHARTLI_MOS
r = evaluate(defs, { a: pass(3), b: pass(3), c: pass(4) });
assert.equal(r.verdict, "SHARTLI_MOS");

// kritik 2 -> MOS_EMAS
r = evaluate(defs, { a: pass(5), b: pass(2), c: pass(4) });
assert.equal(r.verdict, "MOS_EMAS");
assert.equal(r.criticalFail, true);

// kritik 2.5 -> RIVOJLANTIRISH
r = evaluate(defs, {
  a: pass(3),
  b: [...pass(2), { level: 3, score: 0.6 }],
  c: pass(4),
});
assert.equal(r.verdict, "RIVOJLANTIRISH");

// qizil bayroq -> MOS_EMAS
r = evaluate(defs, { a: pass(5), b: pass(5), c: pass(5) }, { redFlags: 1 });
assert.equal(r.verdict, "MOS_EMAS");

// baholanmagan kompetensiya qayd etiladi
r = evaluate(defs, { a: pass(3), b: pass(4) });
assert.deepEqual(r.unscored, ["H2"]);

console.log("scoring: OK");

// seededShuffle: deterministik va to'liq permutatsiya
import { seededShuffle } from "../src/lib/shuffle";
const base = [0, 1, 2, 3, 4, 5];
assert.deepEqual(seededShuffle(base, "a:b"), seededShuffle(base, "a:b"));
assert.deepEqual([...seededShuffle(base, "x")].sort(), base);
assert.notDeepEqual(seededShuffle(base, "seed-1"), seededShuffle(base, "seed-2"));
console.log("shuffle: OK");
