// V1 «Qadriyatlar» kompetensiyasini barcha lavozimlarga qo'shadi (savollarga tegmaydi). Idempotent.
// Ishga tushirish: npx tsx scripts/add-values-competency.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, CompetencyType } from "@prisma/client";

for (const line of readFileSync(resolve(__dirname, "../.env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const prisma = new PrismaClient();

(async () => {
  const positions = await prisma.position.findMany({ include: { competencies: true } });
  for (const p of positions) {
    const max = Math.max(-1, ...p.competencies.map((c) => c.sortOrder));
    const r = await prisma.competency.upsert({
      where: { positionId_code: { positionId: p.id, code: "V1" } },
      update: { name: "Qadriyatlar: halollik, maxfiylik va mas'uliyat", target: 4, weight: 8, critical: true },
      create: {
        positionId: p.id,
        code: "V1",
        name: "Qadriyatlar: halollik, maxfiylik va mas'uliyat",
        type: CompetencyType.SOFT,
        target: 4,
        weight: 8,
        critical: true,
        sortOrder: max + 1,
      },
    });
    console.log(p.code, "V1", r.id);
  }
  await prisma.$disconnect();
})();
