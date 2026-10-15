"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWriter } from "@/lib/auth";

export type ActionState = { ok: boolean; message: string } | null;

const name = z.string().trim().min(2, "Nom kamida 2 belgi").max(60, "Nom 60 belgidan oshmasin");

const refresh = (code?: string) => {
  revalidatePath("/hr/savollar");
  if (code) revalidatePath(`/hr/savollar/test/${code}`);
};

export async function createDepartment(raw: string): Promise<ActionState> {
  const user = await requireWriter();
  const p = name.safeParse(raw);
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (await db.department.findUnique({ where: { name: p.data } })) return { ok: false, message: "Bunday nomli bo'lim bor" };
  const max = await db.department.aggregate({ _max: { sortOrder: true } });
  const d = await db.department.create({ data: { name: p.data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  await db.auditLog.create({ data: { actorId: user.id, action: "department.create", entity: "Department", entityId: d.id, meta: { name: d.name } } });
  refresh();
  return { ok: true, message: `«${d.name}» bo'limi qo'shildi` };
}

export async function renameDepartment(id: string, raw: string): Promise<ActionState> {
  const user = await requireWriter();
  const p = name.safeParse(raw);
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const clash = await db.department.findUnique({ where: { name: p.data } });
  if (clash && clash.id !== id) return { ok: false, message: "Bunday nomli bo'lim bor" };
  const d = await db.department.update({ where: { id }, data: { name: p.data } });
  // Matnli nusxa (generator va hisobotlar uchun) ham yangilanadi
  await db.position.updateMany({ where: { departmentId: id }, data: { department: d.name } });
  await db.auditLog.create({ data: { actorId: user.id, action: "department.rename", entity: "Department", entityId: id, meta: { name: d.name } } });
  refresh();
  return { ok: true, message: "Nomi o'zgartirildi" };
}

/** Bo'lim o'chirilsa, uning testlari «Bo'limsiz» guruhiga o'tadi (testlar o'chmaydi). */
export async function deleteDepartment(id: string): Promise<ActionState> {
  const user = await requireWriter();
  const d = await db.department.findUnique({ where: { id }, include: { _count: { select: { positions: true } } } });
  if (!d) return { ok: false, message: "Bo'lim topilmadi" };
  await db.department.delete({ where: { id } });
  await db.auditLog.create({
    data: { actorId: user.id, action: "department.delete", entity: "Department", entityId: id, meta: { name: d.name, tests: d._count.positions } },
  });
  refresh();
  return { ok: true, message: `«${d.name}» o'chirildi${d._count.positions ? `; ${d._count.positions} ta test «Bo'limsiz»ga o'tdi` : ""}` };
}

export async function setPositionDepartment(positionId: string, departmentId: string | null): Promise<ActionState> {
  const user = await requireWriter();
  const dep = departmentId ? await db.department.findUnique({ where: { id: departmentId } }) : null;
  if (departmentId && !dep) return { ok: false, message: "Bo'lim topilmadi" };
  const pos = await db.position.update({
    where: { id: positionId },
    data: { departmentId: dep?.id ?? null, ...(dep ? { department: dep.name } : {}) },
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "position.department", entity: "Position", entityId: positionId, meta: { department: dep?.name ?? null } },
  });
  refresh(pos.code);
  return { ok: true, message: dep ? `«${dep.name}» bo'limiga biriktirildi` : "Bo'limsiz qoldirildi" };
}

const timeSchema = z.object({ positionId: z.string().min(1), minutes: z.number().int().min(5).max(600).nullable() });

/** Test umumiy vaqti (daqiqa). null — savollar vaqtining yig'indisi. Konstruktordagi savollar tarkibiga tegmaydi. */
export async function setTestTime(input: unknown): Promise<ActionState> {
  const user = await requireWriter();
  const p = timeSchema.safeParse(input);
  if (!p.success) return { ok: false, message: "Vaqt 5 daqiqadan 10 soatgacha bo'lishi kerak" };
  const { positionId, minutes } = p.data;
  const pos = await db.position.findUnique({ where: { id: positionId }, select: { code: true } });
  if (!pos) return { ok: false, message: "Test topilmadi" };
  await db.testConfig.upsert({
    where: { positionId },
    create: { positionId, timeLimitMin: minutes, updatedById: user.id },
    update: { timeLimitMin: minutes, updatedById: user.id },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "testconfig.time", entity: "TestConfig", entityId: positionId, meta: { minutes } } });
  refresh(pos.code);
  revalidatePath("/hr/konstruktor");
  return { ok: true, message: minutes ? `Saqlandi: ${Math.floor(minutes / 60)} soat ${minutes % 60} daqiqa. Bundan keyin boshlanadigan testlarga qo'llanadi.` : "Avtomatik vaqtga qaytarildi" };
}
