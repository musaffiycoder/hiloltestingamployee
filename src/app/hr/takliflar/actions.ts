"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  subjectName: z.string().trim().min(2, "Ismni kiriting").max(120),
  contact: z.string().trim().max(120).optional(),
  positionId: z.string().min(1, "Lavozimni tanlang"),
  mode: z.enum(["RECRUITING", "EVALUATION"]),
  dueAt: z.string().optional(),
});

export type InviteState = { error?: string; link?: string };

export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    subjectName: form.get("subjectName"),
    contact: form.get("contact") || undefined,
    positionId: form.get("positionId"),
    mode: form.get("mode"),
    dueAt: form.get("dueAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };

  const position = await db.position.findUnique({
    where: { id: parsed.data.positionId },
    include: { competencies: { include: { _count: { select: { questions: true } } } } },
  });
  if (!position) return { error: "Lavozim topilmadi" };
  if (position.competencies.every((c) => c._count.questions === 0)) {
    return { error: "Bu lavozim uchun hali savollar yo'q. Avval savollar bankini to'ldiring." };
  }

  const token = randomBytes(12).toString("base64url");
  await db.assessment.create({
    data: {
      token,
      positionId: position.id,
      mode: parsed.data.mode,
      subjectName: parsed.data.subjectName,
      contact: parsed.data.contact,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      createdById: user.id,
    },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "invite.create", entity: "Assessment", meta: { positionId: position.id } } });
  revalidatePath("/hr/takliflar");
  return { link: `${await baseUrl()}/t/${token}` };
}

/** Joriy so'rov manzilidan asosiy URL (Vercel, custom domen va lokal uchun bir xil ishlaydi). */
async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
