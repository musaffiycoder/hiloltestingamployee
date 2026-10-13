"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Email va parolni kiriting" };
  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Doim bir xil javob: foydalanuvchi mavjudligini oshkor qilmaymiz
  const ok = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { error: "Email yoki parol noto'g'ri" };
  await createSession(user.id);
  redirect("/hr");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
