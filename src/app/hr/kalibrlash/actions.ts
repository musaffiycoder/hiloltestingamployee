"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";

const schema = z.object({
  responseId: z.string().min(1),
  score: z.union([z.literal(0), z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)]),
});

/** Ko'r-ko'rona baho: baholovchi AI ballini ko'rmaydi. */
export async function submitCalibration(input: unknown) {
  const user = await requireWriter();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false as const };
  const r = await db.response.findUnique({ where: { id: p.data.responseId }, select: { aiScore: true, question: { select: { type: true } } } });
  if (!r || r.question.type !== "OPEN" || r.aiScore === null) return { ok: false as const };
  await db.calibrationRating.upsert({
    where: { responseId_raterId: { responseId: p.data.responseId, raterId: user.id } },
    create: { responseId: p.data.responseId, raterId: user.id, score: p.data.score },
    update: { score: p.data.score, at: new Date() },
  });
  revalidatePath("/hr/kalibrlash");
  return { ok: true as const };
}
