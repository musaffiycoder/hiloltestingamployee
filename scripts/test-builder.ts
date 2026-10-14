// Test konstruktori: taqsimlash va muvozanatli tanlash
import assert from "node:assert";
import { distributeByWeight } from "../src/lib/test-config-math";

const items = [
  { code: "S1", weight: 10, available: 2 },
  { code: "H1", weight: 30, available: 5 },
  { code: "H2", weight: 20, available: 5 },
  { code: "V1", weight: 8, available: 5 },
  { code: "X", weight: 5, available: 0 },
];
const d = distributeByWeight(items, 12);
assert.equal(Object.values(d).reduce((s, n) => s + n, 0), 12, "jami 12");
assert.ok(d.S1 <= 2 && d.X === 0 && d.H1 >= d.H2 && d.H2 >= d.V1 && d.V1 >= 1, JSON.stringify(d));
assert.equal(Object.values(distributeByWeight(items, 100)).reduce((s, n) => s + n, 0), 17, "bankdan oshmaydi");
assert.deepEqual(distributeByWeight(items, 2), { S1: 0, H1: 1, H2: 1, V1: 0, X: 0 }, "kam bo'lsa og'ir vaznlilar");

// pickBalanced (test-config.ts db import qiladi — funksiyani alohida nusxalab emas, dinamik import bilan)
(async () => {
  const { pickBalanced } = await import("../src/lib/test-config");
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, level: 3, type: "MCQ_SINGLE" })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `b${i}`, level: 3, type: "OPEN" })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, level: 4, type: "SITUATIONAL" })),
  ];
  const pick = pickBalanced(pool, 4, rnd);
  assert.equal(pick.length, 4);
  assert.equal(new Set(pick.map((p) => p.id)).size, 4, "takrorsiz");
  assert.equal(pick.filter((p) => p.level === 3).length, 2, "darajalar teng");
  assert.ok(pick.some((p) => p.type === "OPEN"), "3-darajada turlar aralash");
  assert.equal(pickBalanced(pool, 99, rnd).length, pool.length);
  console.log("builder: OK", d);
  process.exit(0);
})();
