"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, requireWriter } from "@/lib/auth";
import { analyzeBatch, analyzeQuestion, type Warning } from "@/lib/question-quality";
import {
  parseImportJson,
  toDbShape,
  toQualityShape,
  validateQuestion,
  type ImportQuestion,
} from "@/lib/question-schema";

export type PreviewItem = {
  index: number;
  ok: boolean;
  errors: string[];
  warnings: Warning[];
  title: string;
  where: string;
  duplicate: boolean;
};
export type PreviewResult =
  | { ok: false; error: string }
  | { ok: true; items: PreviewItem[]; batchWarnings: Warning[]; valid: number; invalid: number };

async function competencyIndex() {
  const rows = await db.competency.findMany({ select: { id: true, code: true, position: { select: { code: true, title: true } } } });
  return new Map(rows.map((r) => [`${r.position.code}:${r.code}`, r]));
}

async function resolve(items: unknown[]) {
  const idx = await competencyIndex();
  const existing = await db.question.findMany({ select: { stem: true, competencyId: true } });
  const seen = new Set(existing.map((e) => `${e.competencyId}:${e.stem.trim().toLowerCase()}`));
  const qualityShapes: ReturnType<typeof toQualityShape>[] = [];
  const out = items.map((raw, index) => {
    const v = validateQuestion(raw);
    const r = raw as { position?: string; competency?: string; stem?: string };
    const title = (r?.stem ?? "").toString().slice(0, 90);
    if (!v.ok) return { index, ok: false, errors: v.errors, warnings: [] as Warning[], title, where: `${r?.position ?? "?"} · ${r?.competency ?? "?"}`, duplicate: false, q: null, competencyId: null as string | null };
    const comp = idx.get(`${v.q.position}:${v.q.competency}`);
    const errors: string[] = [];
    if (!comp) errors.push(`«${v.q.position}» lavozimida «${v.q.competency}» kompetensiyasi topilmadi`);
    const shape = toQualityShape(v.q);
    qualityShapes.push(shape);
    const duplicate = comp ? seen.has(`${comp.id}:${v.q.stem.trim().toLowerCase()}`) : false;
    return {
      index,
      ok: errors.length === 0,
      errors,
      warnings: analyzeQuestion(shape),
      title,
      where: comp ? `${comp.position.title} · ${v.q.competency}` : `${v.q.position} · ${v.q.competency}`,
      duplicate,
      q: v.q as ImportQuestion,
      competencyId: comp?.id ?? null,
    };
  });
  return { out, batchWarnings: analyzeBatch(qualityShapes) };
}

export async function previewImport(text: string): Promise<PreviewResult> {
  await requireUser();
  const parsed = parseImportJson(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { out, batchWarnings } = await resolve(parsed.items);
  const items: PreviewItem[] = out.map((o) => ({ index: o.index, ok: o.ok, errors: o.errors, warnings: o.warnings, title: o.title, where: o.where, duplicate: o.duplicate }));
  return { ok: true, items, batchWarnings, valid: items.filter((i) => i.ok).length, invalid: items.filter((i) => !i.ok).length };
}

export async function commitImport(text: string, status: "ACTIVE" | "DRAFT", skipDuplicates: boolean) {
  const user = await requireWriter();
  const parsed = parseImportJson(text);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  const { out } = await resolve(parsed.items);
  const rows = out.filter((o) => o.ok && o.q && o.competencyId && !(skipDuplicates && o.duplicate));
  if (rows.length === 0) return { ok: false as const, error: "Import qilinadigan to'g'ri savol topilmadi" };

  await db.question.createMany({
    data: rows.map((o) => {
      const q = o.q as ImportQuestion;
      const shape = toDbShape(q);
      return {
        competencyId: o.competencyId as string,
        level: q.level,
        type: q.type,
        stem: q.stem,
        payload: shape.payload as Prisma.InputJsonValue,
        answerKey: shape.answerKey as Prisma.InputJsonValue | undefined,
        rubric: shape.rubric as Prisma.InputJsonValue | undefined,
        explanation: q.explanation,
        timeLimitSec: q.timeLimitSec ?? (q.type === "OPEN" ? 240 : 90),
        aiAllowed: q.competency.startsWith("H") && /AI|prompt/i.test(q.stem),
        status: q.status ?? status,
      };
    }),
  });
  await db.auditLog.create({
    data: { actorId: user.id, action: "question.import", entity: "Question", meta: { count: rows.length, status } },
  });
  revalidatePath("/hr/savollar");
  return { ok: true as const, imported: rows.length, skipped: out.length - rows.length };
}

const saveSchema = z.object({ id: z.string().optional(), question: z.unknown(), status: z.enum(["ACTIVE", "DRAFT", "RETIRED"]) });

/** Bitta savolni yaratish/yangilash. Javoblari bor savol tahrirlansa — yangi versiya yaratiladi (tarix saqlanadi). */
export async function saveQuestion(input: unknown) {
  const user = await requireWriter();
  const p = saveSchema.safeParse(input);
  if (!p.success) return { ok: false as const, errors: ["So'rov noto'g'ri"] };
  const v = validateQuestion(p.data.question);
  if (!v.ok) return { ok: false as const, errors: v.errors };
  const q = v.q;

  const comp = await db.competency.findFirst({
    where: { code: q.competency, position: { code: q.position } },
    select: { id: true },
  });
  if (!comp) return { ok: false as const, errors: ["Kompetensiya topilmadi"] };

  const shape = toDbShape(q);
  const data = {
    competencyId: comp.id,
    level: q.level,
    type: q.type,
    stem: q.stem,
    payload: shape.payload as Prisma.InputJsonValue,
    answerKey: (shape.answerKey ?? undefined) as Prisma.InputJsonValue | undefined,
    rubric: (shape.rubric ?? undefined) as Prisma.InputJsonValue | undefined,
    explanation: q.explanation || null,
    timeLimitSec: q.timeLimitSec ?? 90,
    status: p.data.status,
  };

  let id: string;
  if (!p.data.id) {
    id = (await db.question.create({ data })).id;
  } else {
    const old = await db.question.findUnique({ where: { id: p.data.id }, select: { id: true, version: true, _count: { select: { responses: true } } } });
    if (!old) return { ok: false as const, errors: ["Savol topilmadi"] };
    if (old._count.responses > 0) {
      const [created] = await db.$transaction([
        db.question.create({ data: { ...data, version: old.version + 1 } }),
        db.question.update({ where: { id: old.id }, data: { status: "RETIRED" } }),
      ]);
      id = created.id;
    } else {
      id = (await db.question.update({ where: { id: old.id }, data })).id;
    }
  }
  await db.auditLog.create({ data: { actorId: user.id, action: p.data.id ? "question.update" : "question.create", entity: "Question", entityId: id } });
  revalidatePath("/hr/savollar");
  return { ok: true as const, id };
}

export async function setQuestionStatus(id: string, status: "ACTIVE" | "DRAFT" | "RETIRED") {
  const user = await requireWriter();
  await db.question.update({ where: { id }, data: { status } });
  await db.auditLog.create({ data: { actorId: user.id, action: "question.status", entity: "Question", entityId: id, meta: { status } } });
  revalidatePath("/hr/savollar");
}

export async function activateDrafts(positionCode: string | null) {
  const user = await requireWriter();
  const res = await db.question.updateMany({
    where: { status: "DRAFT", ...(positionCode ? { competency: { position: { code: positionCode } } } : {}) },
    data: { status: "ACTIVE" },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "question.activate_drafts", entity: "Question", meta: { count: res.count } } });
  revalidatePath("/hr/savollar");
  return res.count;
}

/** Javoblari bo'lmagan savolni o'chiradi; bo'lsa arxivga o'tkazadi. */
export async function deleteQuestion(id: string) {
  const user = await requireWriter();
  const q = await db.question.findUnique({ where: { id }, select: { _count: { select: { responses: true } } } });
  if (!q) return { ok: false as const };
  if (q._count.responses > 0) {
    await db.question.update({ where: { id }, data: { status: "RETIRED" } });
  } else {
    await db.question.delete({ where: { id } });
  }
  await db.auditLog.create({ data: { actorId: user.id, action: "question.delete", entity: "Question", entityId: id } });
  revalidatePath("/hr/savollar");
  return { ok: true as const, archived: q._count.responses > 0 };
}
