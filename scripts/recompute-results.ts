// Barcha yakunlangan urinishlar natijasini joriy baholash qoidasi bilan qayta hisoblaydi.
// Ishlatish: npx tsx --env-file=.env --conditions=react-server scripts/recompute-results.ts [zaxira.json]
// Avval joriy natijalar zaxira faylga yoziladi (birinchi argument), keyin computeAttempt chaqiriladi.
import { writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { computeAttempt } from "../src/lib/attempt";

(async () => {
  const backupPath = process.argv[2];
  if (!backupPath) throw new Error("Zaxira fayl yo'li kerak");
  const results = await db.attemptResult.findMany({
    include: { attempt: { include: { scores: true, responses: { select: { id: true, score: true, scoreSource: true } }, assessment: { select: { subjectName: true } } } } },
  });
  writeFileSync(backupPath, JSON.stringify(results, null, 2));
  console.log(`Zaxira: ${results.length} ta natija → ${backupPath}`);
  for (const r of results) {
    const ev = await computeAttempt(r.attemptId);
    console.log(`${r.attempt.assessment.subjectName}: ${r.overallPct}% ${r.verdict} → ${ev?.overallPct}% ${ev?.verdict}`);
  }
  await db.$disconnect();
})();
