// Sifatni solishtirish: bitta natijani `medium` va `high` bilan tahlil qiladi (bazaga YOZMAYDI, pul sarflaydi).
// Ishga tushirish: npx tsx --conditions=react-server scripts/compare-effort.ts [attemptId]
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { generateAnalysis } from "../src/lib/ai/review";

(async () => {
  const id = process.argv[2] ?? (await db.attemptResult.findFirstOrThrow({ select: { attemptId: true } })).attemptId;
  const out: Record<string, unknown> = {};
  for (const effort of ["medium", "high"] as const) {
    const t = Date.now();
    const r = await generateAnalysis(id, { effort, save: false, deadline: Date.now() + 290_000 });
    const sec = Math.round((Date.now() - t) / 1000);
    console.log(`${effort}: ${sec}s, kirish ${r.inputTokens}, chiqish ${r.outputTokens}, tekshiruv kamchiliklari: ${r.issues.length}${r.escalated ? " (high bilan qayta yozilgan)" : ""}`);
    if (r.issues.length) console.log("  -", r.issues.join("\n  - "));
    out[effort] = { sec, tokens: [r.inputTokens, r.outputTokens], issues: r.issues, analysis: r.stored };
  }
  const file = path.join(__dirname, "..", "data", `compare-${id}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("Saqlandi:", file);
  process.exit(0);
})();
