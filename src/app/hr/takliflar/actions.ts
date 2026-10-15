"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";

const schema = z.object({
  subjectName: z.string().trim().min(2, "Ismni kiriting").max(120),
  contact: z.string().trim().max(120).optional(),
  positionId: z.string().min(1, "Lavozimni tanlang"),
  mode: z.enum(["RECRUITING", "EVALUATION"]),
  dueAt: z.string().optional(),
});

export type InviteState = { error?: string; link?: string };

export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const user = await requireWriter();
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
    include: { competencies: { include: { _count: { select: { questions: { where: { status: "ACTIVE" } } } } } } },
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

/** Taklifni bekor qiladi: boshlanmagan bo'lsa o'chiriladi, jarayonda bo'lsa muddati tugatiladi. */
export async function cancelInvite(id: string) {
  const user = await requireWriter();
  const a = await db.assessment.findUnique({ where: { id }, select: { status: true } });
  if (!a) return { ok: false as const, error: "Taklif topilmadi" };
  if (a.status === "SUBMITTED") return { ok: false as const, error: "Topshirilgan taklifni bekor qilib bo'lmaydi" };
  if (a.status === "INVITED") await db.assessment.delete({ where: { id } });
  else await db.assessment.update({ where: { id }, data: { status: "EXPIRED" } });
  await db.auditLog.create({ data: { actorId: user.id, action: "invite.cancel", entity: "Assessment", entityId: id } });
  revalidatePath("/hr/takliflar");
  return { ok: true as const };
}

/**
 * Boshlangan, lekin topshirilmagan testni qayta boshlash: tugallanmagan urinish (javoblari bilan) o'chiriladi,
 * taklif «yuborilgan» holatiga qaytadi va nomzod shu havola orqali vaqtni noldan boshlaydi.
 */
export async function restartInvite(id: string) {
  const user = await requireWriter();
  const a = await db.assessment.findUnique({
    where: { id },
    select: { status: true, attempts: { where: { finishedAt: null }, select: { id: true, _count: { select: { responses: true } } } } },
  });
  if (!a) return { ok: false as const, error: "Taklif topilmadi" };
  if (a.status !== "STARTED") return { ok: false as const, error: "Faqat jarayondagi testni qayta boshlash mumkin" };
  const answers = a.attempts.reduce((s, x) => s + x._count.responses, 0);
  await db.$transaction([
    db.attempt.deleteMany({ where: { assessmentId: id, finishedAt: null } }),
    db.assessment.update({ where: { id }, data: { status: "INVITED" } }),
  ]);
  await db.auditLog.create({ data: { actorId: user.id, action: "invite.restart", entity: "Assessment", entityId: id, meta: { answers } } });
  revalidatePath("/hr/takliflar");
  return { ok: true as const };
}
