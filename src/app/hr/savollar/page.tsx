import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, LevelChip, Pill, SectionTitle } from "@/components/ui";
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
    `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium ${on ? "bg-brf text-onbr" : "bg-card text-tx"}`;

  // Kompetensiya bo'yicha guruhlash (tartib saqlanadi)
  const groups: { key: string; title: string; items: typeof questions }[] = [];
  for (const x of questions) {
    const key = x.competencyId;
    let g = groups.find((y) => y.key === key);
    if (!g) {
      g = { key, title: `${x.competency.code} · ${x.competency.name}`, items: [] };
      groups.push(g);
    }
    g.items.push(x);
  }

  return (
    <div className="flex flex-col gap-4">
      <form action="/hr/savollar" className="relative">
        {pos && <input type="hidden" name="p" value={pos} />}
        {lvl ? <input type="hidden" name="l" value={lvl} /> : null}
        <Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tx2" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Qidirish"
          aria-label="Savol matni bo'yicha qidirish"
          className="h-10 w-full rounded-[10px] bg-soft pl-9 pr-3 text-[17px] outline-none placeholder:text-tx2"
        />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
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

      <div className="flex items-center gap-3">
        <span className="shrink-0 text-[13px] font-semibold uppercase tracking-wide text-tx2">Daraja</span>
        <div className="grid flex-1 grid-cols-6 rounded-[10px] bg-soft p-0.5 md:max-w-sm" role="group" aria-label="Daraja">
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <Link
              key={l}
              href={href({ l: l ? String(l) : "" })}
              className={`rounded-lg py-1.5 text-center text-[13px] font-semibold ${
                (lvl || 0) === l ? "bg-card shadow-[0_1px_3px_rgba(0,0,0,0.18)]" : ""
              }`}
              aria-current={(lvl || 0) === l ? "true" : undefined}
            >
              {l === 0 ? "Hammasi" : l}
            </Link>
          ))}
        </div>
      </div>

      <p className="px-1 text-[13px] text-tx2">
        {total} ta savol{total > questions.length ? ` (dastlabki ${questions.length} tasi)` : ""}. Javob kalitlari faqat HR ga
        ko'rinadi.
      </p>

      {questions.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-[17px] font-semibold">Savol topilmadi</div>
          <p className="mt-1 text-[15px] text-tx2">Filtrni o'zgartiring yoki lavozim uchun savollar yarating.</p>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <SectionTitle>{g.title}</SectionTitle>
            <Card>
              {g.items.map((x, i) => {
                const opts = ((x.payload as { options?: Opt[] })?.options ?? []) as Opt[];
                const key = (x.answerKey as { correct?: number | number[] } | null)?.correct;
                const correct = new Set(Array.isArray(key) ? key : typeof key === "number" ? [key] : []);
                const rubric = (x.rubric as { points?: string[] } | null)?.points;
                return (
                  <details key={x.id} className={`group ${i < g.items.length - 1 ? "border-b border-line" : ""}`}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[15px] font-medium">{x.stem}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <LevelChip level={x.level} />
                          <Pill tone="soft">{QUESTION_TYPE_LABELS[x.type]}</Pill>
                          <Pill tone="soft">{x.timeLimitSec}s</Pill>
                        </span>
                      </span>
                      <span aria-hidden className="text-lg text-tx2 transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <div className="bg-soft/50 px-4 py-3">
                      {opts.length > 0 && (
                        <ul className="overflow-hidden rounded-xl bg-card">
                          {opts.map((o, k) => {
                            const pts = typeof o === "object" ? o.points : undefined;
                            const isCorrect = correct.has(k) || (pts !== undefined && pts >= 5);
                            return (
                              <li
                                key={k}
                                className={`flex items-start gap-3 px-3 py-2.5 text-[15px] ${k < opts.length - 1 ? "border-b border-line" : ""}`}
                              >
                                <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${isCorrect ? "text-ok" : "text-transparent"}`} aria-hidden>
                                  ✓
                                </span>
                                <span className="flex-1">{text(o)}</span>
                                {pts !== undefined && <span className="text-[13px] font-semibold text-tx2">{pts} ball</span>}
                                {typeof o === "object" && o.flag && <span className="text-[13px] font-semibold text-bad">⚑</span>}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {x.type === "OPEN" && rubric && (
                        <ul className="list-disc pl-5 text-[15px] text-tx2">
                          {rubric.map((p) => <li key={p}>{p}</li>)}
                        </ul>
                      )}
                      {x.explanation && <p className="mt-2 text-[13px] text-tx2">{x.explanation}</p>}
                    </div>
                  </details>
                );
              })}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
