import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, CompetencyType, QuestionType } from "@prisma/client";
import type { SeedQuestion } from "./seed-types";

// .env ni qo'lda yuklash (tsx uchun)
for (const line of readFileSync(resolve(__dirname, "../.env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const prisma = new PrismaClient();

type JsonComp = { id: string; name: string; type: "soft" | "hard"; target: number; weight: number; critical: boolean; derived?: boolean };
type JsonPos = { id: string; title: string; card: string; competencies: JsonComp[] };

async function main() {
  const dataDir = resolve(__dirname, "../data");
  const matrixPath = resolve(dataDir, "competencies.json");
  if (!existsSync(matrixPath)) {
    throw new Error("data/competencies.json topilmadi. data/README.md ga qarang.");
  }
  const matrix = JSON.parse(readFileSync(matrixPath, "utf8")) as { positions: JsonPos[] };

  for (const p of matrix.positions) {
    const pos = await prisma.position.upsert({
      where: { code: p.id },
      update: { title: p.title, cardFile: p.card },
      create: { code: p.id, title: p.title, cardFile: p.card },
    });
    let order = 0;
    for (const c of p.competencies) {
      await prisma.competency.upsert({
        where: { positionId_code: { positionId: pos.id, code: c.id } },
        update: { name: c.name, target: c.target, weight: c.weight, critical: c.critical, derived: !!c.derived, sortOrder: order },
        create: {
          positionId: pos.id,
          code: c.id,
          name: c.name,
          type: c.type === "soft" ? CompetencyType.SOFT : CompetencyType.HARD,
          target: c.target,
          weight: c.weight,
          critical: c.critical,
          derived: !!c.derived,
          sortOrder: order,
        },
      });
      order++;
    }
  }

  // Backend savollari: data/questions-backend.ts (git'ga kiritilmaydi — javob kalitlari bor).
  // Qayta ishga tushirilganda dublikat bo'lmasligi uchun avval tozalanadi.
  const questionsPath = resolve(dataDir, "questions-backend.ts");
  const backendQuestions: SeedQuestion[] = existsSync(questionsPath)
    ? ((await import(questionsPath)) as { backendQuestions: SeedQuestion[] }).backendQuestions
    : [];
  if (backendQuestions.length === 0) console.warn("seed: data/questions-backend.ts yo'q, savollar yuklanmadi");
  const backend = await prisma.position.findUniqueOrThrow({ where: { code: "backend" }, include: { competencies: true } });
  const byCode = new Map(backend.competencies.map((c) => [c.code, c.id]));
  if (backendQuestions.length > 0) {
    await prisma.question.deleteMany({ where: { competencyId: { in: [...byCode.values()] } } });
  }
  for (const q of backendQuestions) {
    const competencyId = byCode.get(q.comp);
    if (!competencyId) throw new Error(`Noma'lum kompetensiya: ${q.comp}`);
    await prisma.question.create({
      data: {
        competencyId,
        level: q.level,
        type: q.type as QuestionType,
        stem: q.stem,
        payload: q.type === "SITUATIONAL" ? { options: q.situational } : q.options ? { options: q.options } : {},
        answerKey: q.key === undefined ? undefined : { correct: q.key },
        rubric: q.rubric ? { points: q.rubric } : undefined,
        explanation: q.explanation,
        timeLimitSec: q.timeLimitSec ?? 120,
        aiAllowed: q.comp === "H5",
      },
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL!;
  const password = process.env.SEED_ADMIN_PASSWORD!;
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "HR menejer", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });

  const [pc, cc, qc] = await Promise.all([prisma.position.count(), prisma.competency.count(), prisma.question.count()]);
  console.log(`seed: ${pc} lavozim, ${cc} kompetensiya, ${qc} savol`);
}

main().finally(() => prisma.$disconnect());
