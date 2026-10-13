// Savollar JSON'ini bazaga qo'shadi (HR import oynasidagi bilan bir xil qoidalar).
// Ishga tushirish: npx tsx scripts/import-questions.ts <fayl.json> [ACTIVE|DRAFT] [--dry]
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { parseImportJson, toDbShape, validateQuestion } from "../src/lib/question-schema";

for (const line of readFileSync(resolve(__dirname, "../.env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const prisma = new PrismaClient();

(async () => {
  const [file, statusArg, flag] = process.argv.slice(2);
  const status = statusArg === "DRAFT" ? "DRAFT" : "ACTIVE";
  const parsed = parseImportJson(fs.readFileSync(file, "utf8"));
  if (!parsed.ok) throw new Error(parsed.error);

  const comps = await prisma.competency.findMany({ select: { id: true, code: true, position: { select: { code: true } } } });
  const byKey = new Map(comps.map((c) => [`${c.position.code}:${c.code}`, c.id]));

  let created = 0, dup = 0, invalid = 0;
  for (const [i, raw] of parsed.items.entries()) {
    const v = validateQuestion(raw);
    if (!v.ok) { invalid++; console.log(`#${i + 1} yaroqsiz:`, v.errors.join("; ")); continue; }
    const q = v.q;
    const competencyId = byKey.get(`${q.position}:${q.competency}`);
    if (!competencyId) { invalid++; console.log(`#${i + 1} kompetensiya topilmadi: ${q.position}:${q.competency}`); continue; }
    const exists = await prisma.question.findFirst({ where: { competencyId, stem: q.stem, status: { not: "RETIRED" } }, select: { id: true } });
    if (exists) { dup++; continue; }
    if (flag === "--dry") { created++; continue; }
    const shape = toDbShape(q);
    await prisma.question.create({
      data: {
        competencyId,
        level: q.level,
        type: q.type,
        stem: q.stem,
        payload: shape.payload as Prisma.InputJsonValue,
        answerKey: shape.answerKey as Prisma.InputJsonValue | undefined,
        rubric: shape.rubric as Prisma.InputJsonValue | undefined,
        explanation: q.explanation,
        timeLimitSec: q.timeLimitSec ?? (q.type === "OPEN" ? 240 : 90),
        aiAllowed: q.competency.startsWith("H") && /AI|prompt/i.test(q.stem),
        status: q.status ?? status,
      },
    });
    created++;
  }
  console.log(`${flag === "--dry" ? "[dry] " : ""}qo'shildi: ${created}, dublikat: ${dup}, yaroqsiz: ${invalid}, holat: ${status}`);
  await prisma.$disconnect();
})();
