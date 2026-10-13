"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";

export type FormState = { ok?: boolean; error?: string; message?: string };

const pwSchema = z
  .object({
    current: z.string().min(1, "Joriy parolni kiriting"),
    next: z.string().min(10, "Yangi parol kamida 10 belgi bo'lsin").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Yangi parol va tasdiq mos emas", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Yangi parol joriyidan farq qilsin", path: ["next"] });

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await allow(`pw:${user.id}`, 5, 900))) return { error: "Juda ko'p urinish. 15 daqiqadan keyin urinib ko'ring." };
  const p = pwSchema.safeParse({ current: form.get("current"), next: form.get("next"), confirm: form.get("confirm") });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(p.data.current, row.passwordHash))) return { error: "Joriy parol noto'g'ri" };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(p.data.next, 11) } });
  await db.auditLog.create({ data: { actorId: user.id, action: "user.password_change", entity: "User", entityId: user.id } });
  return { ok: true, message: "Parol yangilandi" };
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Ismni kiriting").max(80),
  email: z.string().trim().toLowerCase().email("Email noto'g'ri"),
  role: z.enum(["HR", "MANAGER", "ADMIN"]),
  password: z.string().min(10, "Vaqtinchalik parol kamida 10 belgi bo'lsin").max(128),
});

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  if (me.role !== "ADMIN") return { error: "Faqat admin foydalanuvchi qo'sha oladi" };
  const p = userSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    role: form.get("role"),
    password: form.get("password"),
  });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
  if (await db.user.findUnique({ where: { email: p.data.email } })) return { error: "Bu email allaqachon mavjud" };

  const u = await db.user.create({
    data: { name: p.data.name, email: p.data.email, role: p.data.role, passwordHash: await bcrypt.hash(p.data.password, 11) },
  });
  await db.auditLog.create({ data: { actorId: me.id, action: "user.create", entity: "User", entityId: u.id, meta: { role: p.data.role } } });
  revalidatePath("/hr/sozlamalar");
  return { ok: true, message: `${p.data.name} qo'shildi. Vaqtinchalik parolni ularga o'zingiz yetkazing.` };
}
