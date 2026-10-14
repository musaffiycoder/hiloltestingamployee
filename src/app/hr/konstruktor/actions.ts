"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";

const configSchema = z.object({
  positionId: z.string().min(1),
  perCompetency: z.record(z.string().min(1).max(10), z.number().int().min(0).max(200)),
  timeLimitMin: z.number().int().min(5).max(300).nullable(),
  order: z.enum(["competency", "mixed"]),
});

export type SaveState = { ok: boolean; message: string } | null;

export async function saveTestConfig(input: unknown): Promise<SaveState> {
  const user = await requireWriter();
  const p = configSchema.safeParse(input);
  if (!p.success) return { ok: false, message: "Ma'lumot noto'g'ri: qiymatlarni tekshiring" };
  const { positionId, perCompetency, timeLimitMin, order } = p.data;

  const comps = await db.competency.findMany({ where: { positionId }, select: { code: true } });
  const codes = new Set(comps.map((c) => c.code));
  if (!comps.length || Object.keys(perCompetency).some((k) => !codes.has(k))) return { ok: false, message: "Lavozim yoki kompetensiya topilmadi" };
  const total = Object.values(perCompetency).reduce((s, n) => s + n, 0);
  if (total < 5) return { ok: false, message: "Testda kamida 5 ta savol bo'lishi kerak" };

  await db.testConfig.upsert({
    where: { positionId },
    create: { positionId, perCompetency, timeLimitMin, order, updatedById: user.id },
    update: { perCompetency, timeLimitMin, order, updatedById: user.id },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "testconfig.update", entity: "TestConfig", entityId: positionId, meta: { total, timeLimitMin, order } },
  });
  revalidatePath("/hr/konstruktor");
  return { ok: true, message: `Saqlandi: ${total} ta savol. Yangi testlar shu tarkibda yig'iladi.` };
}

export async function resetTestConfig(positionId: string): Promise<SaveState> {
  const user = await requireWriter();
  await db.testConfig.deleteMany({ where: { positionId } });
  await db.auditLog.create({ data: { actorId: user.id, action: "testconfig.reset", entity: "TestConfig", entityId: positionId } });
  revalidatePath("/hr/konstruktor");
  return { ok: true, message: "Standart holatga qaytarildi: bankdagi barcha faol savollar." };
}
