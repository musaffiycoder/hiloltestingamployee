import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, Pill } from "@/components/ui";
import { QUESTION_TYPE_LABELS } from "@/lib/labels";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = { title: "Savollar banki" };

type Opt = string | { text: string; points?: number; flag?: boolean };
const text = (o: Opt) => (typeof o === "string" ? o : o.text);

export default async function QuestionBankPage({ searchParams }: PageProps<"/hr/savollar">) {
  await requireUser();
  const sp = await searchParams;
  const pos = typeof sp.p === "string" ? sp.p : "";
  const lvl = typeof sp.l === "string" ? Number(sp.l) : 0;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  const where: Prisma.QuestionWhereInput = {
    ...(pos ? { competency: { position: { code: pos } } } : {}),
    ...(lvl >= 1 && lvl <= 5 ? { level: lvl } : {}),
    ...(q ? { stem: { contains: q, mode: "insensitive" } } : {}),
  };

  const [positions, questions, total] = await Promise.all([
    db.position.findMany({
      orderBy: { title: "asc" },
      select: { code: true, title: true, competencies: { select: { _count: { select: { questions: true } } } } },
    }),
    db.question.findMany({
      where,
      orderBy: [{ competency: { sortOrder: "asc" } }, { level: "asc" }],
      take: 100,
      include: { competency: { include: { position: { select: { title: true } } } } },
    }),
    db.question.count({ where }),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { p: pos, l: lvl ? String(lvl) : "", q, ...patch };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return `/hr/savollar${s ? `?${s}` : ""}`;
  };
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold border ${on ? "border-br bg-br text-[#1a0c02]" : "border-line bg-card hover:bg-soft"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ p: "" })} className={chip(!pos)}>Barcha lavozimlar</Link>
        {positions.map((p) => {
          const n = p.competencies.reduce((s, c) => s + c._count.questions, 0);
          return (
            <Link key={p.code} href={href({ p: p.code })} className={chip(pos === p.code)}>
              {p.title.split(" (")[0]} <span className="opacity-70">{n}</span>
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-tx2">Daraja:</span>
        <Link href={href({ l: "" })} className={chip(!lvl)}>Hammasi</Link>
        {[1, 2, 3, 4, 5].map((l) => (
          <Link key={l} href={href({ l: String(l) })} className={chip(lvl === l)}>{l}</Link>
        ))}
        <form action="/hr/savollar" className="ml-auto">
          {pos && <input type="hidden" name="p" value={pos} />}
          {lvl ? <input type="hidden" name="l" value={lvl} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="⌕ Savol matni bo'yicha qidirish…"
            className="h-10 w-64 rounded-full border border-line bg-card px-4 text-sm outline-none focus:border-br"
          />
        </form>
      </div>

      <p className="text-sm text-tx2">
        {total} ta savol{total > questions.length ? ` (dastlabki ${questions.length} tasi ko'rsatilmoqda)` : ""}. Javob kalitlari faqat HR ga ko'rinadi.
      </p>

      {questions.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="font-bold">Savol topilmadi</div>
          <p className="mt-1 text-sm text-tx2">Filtrni o'zgartiring yoki lavozim uchun savollar yarating.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((x) => {
            const opts = ((x.payload as { options?: Opt[] })?.options ?? []) as Opt[];
            const key = (x.answerKey as { correct?: number | number[] } | null)?.correct;
            const correct = new Set(Array.isArray(key) ? key : typeof key === "number" ? [key] : []);
            return (
              <Card key={x.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Pill>{x.competency.code}</Pill>
                  <span className="text-xs font-semibold text-tx2">{x.competency.name}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <LevelChip level={x.level} />
                    <Pill tone="soft">{QUESTION_TYPE_LABELS[x.type]}</Pill>
                    <Pill tone="soft">{x.timeLimitSec}s</Pill>
                  </span>
                </div>
                <p className="text-sm font-semibold">{x.stem}</p>
                {opts.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-bold text-brd">Variantlar va kalit</summary>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {opts.map((o, i) => {
                        const isCorrect = correct.has(i);
                        const pts = typeof o === "object" ? o.points : undefined;
                        return (
                          <li
                            key={i}
                            className={`flex gap-2 rounded-xl p-2.5 text-sm ${isCorrect || (pts !== undefined && pts >= 5) ? "bg-ok-t" : "bg-soft"}`}
                          >
                            <b className="w-5 shrink-0">{String.fromCharCode(65 + i)}</b>
                            <span className="flex-1">{text(o)}</span>
                            {pts !== undefined && <span className="text-xs font-bold text-tx2">{pts} ball</span>}
                            {typeof o === "object" && o.flag && <span className="text-xs font-bold text-bad">⚑ bayroq</span>}
                          </li>
                        );
                      })}
                    </ul>
                    {x.explanation && <p className="mt-2 text-xs text-tx2">{x.explanation}</p>}
                  </details>
                )}
                {x.type === "OPEN" && (x.rubric as { points?: string[] } | null)?.points && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-tx2">
                    {(x.rubric as { points: string[] }).points.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
