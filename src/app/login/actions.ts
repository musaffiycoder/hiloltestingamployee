"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { allow, clientIp, reset } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Email va parolni kiriting" };
  const email = parsed.data.email.toLowerCase();
  // Bruteforce himoyasi: email bo'yicha 5 ta va IP bo'yicha 20 ta urinish / 10 daqiqa
  const ip = await clientIp();
  const okEmail = await allow(`login:email:${email}`, 5, 600);
  const okIp = await allow(`login:ip:${ip}`, 20, 600);
  if (!okEmail || !okIp) return { error: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring." };

  const user = await db.user.findUnique({ where: { email } });
  // Doim bir xil javob: foydalanuvchi mavjudligini oshkor qilmaymiz
  const ok = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) return { error: "Email yoki parol noto'g'ri" };
  await reset(`login:email:${email}`);
  await createSession(user.id);
  redirect("/hr");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
